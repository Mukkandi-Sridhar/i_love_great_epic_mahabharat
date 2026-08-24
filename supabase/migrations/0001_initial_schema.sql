-- ============================================================================
-- I Love Great Epic Mahabharat — Postgres schema (Supabase)
--
-- Port of the Firestore model. Two rules carried over from the security work
-- on the Firestore side, because they are what keep the store honest:
--
--   1. Money and access are written only by the backend (service role).
--      Clients may read their own rows; they may never insert or amend an
--      order, purchase, transaction or coupon.
--   2. Admin status lives in a table the client cannot write, never on a
--      user-editable profile column. `profiles.is_admin` deliberately does
--      not exist — a self-serve boolean there was the escalation path we
--      removed from the Firestore rules.
--
-- Apply:  supabase db push      (or paste into the SQL editor)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────────────

create type product_type as enum ('ebook', 'pendrive', 'sdcard');
create type order_status as enum ('processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'paid', 'failed');
create type ticket_status as enum ('open', 'resolved', 'closed');
create type ticket_category as enum ('payment', 'access', 'shipping', 'refund', 'technical', 'other');
create type coupon_type as enum ('percent', 'fixed');

-- ── Identity ────────────────────────────────────────────────────────────────

-- Mirrors auth.users. The id IS the auth uid, so every ownership check is a
-- plain `= auth.uid()` with no join.
create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text,
  name          text,
  phone         text,
  blocked       boolean not null default false,
  -- Set only by the backend; a blocked user is refused at the API layer too.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Admin membership. No client-writable path to this table at all: the RLS
-- policy below grants SELECT of your own row and nothing else. Grants are made
-- with the service role.
create table admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  granted_by  uuid references auth.users (id),
  created_at  timestamptz not null default now()
);

-- SECURITY DEFINER so the check itself is not subject to admins' own RLS,
-- which would otherwise recurse. search_path is pinned to defeat shadowing.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ── Catalog ─────────────────────────────────────────────────────────────────

create table products (
  id             text primary key,
  title          text not null,
  subtitle       text,
  description    text,
  type           product_type not null,
  language       text,
  price          numeric(10, 2) not null check (price >= 0),
  original_price numeric(10, 2) check (original_price >= 0),
  image          text,
  drive_link     text,
  highlights     jsonb not null default '[]'::jsonb,
  rating         numeric(2, 1) check (rating between 0 and 5),
  review_count   integer not null default 0 check (review_count >= 0),
  stock_count    integer not null default 0 check (stock_count >= 0),
  is_physical    boolean generated always as (type in ('pendrive', 'sdcard')) stored,
  enabled        boolean not null default true,
  retired        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Browse queries filter on these three together.
create index products_browse_idx on products (enabled, retired, type);

create table coupons (
  code        text primary key,
  type        coupon_type not null,
  value       numeric(10, 2) not null check (value >= 0),
  enabled     boolean not null default true,
  max_uses    integer check (max_uses > 0),
  used_count  integer not null default 0 check (used_count >= 0),
  expires_at  timestamptz,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Payments ────────────────────────────────────────────────────────────────

-- The server-priced quote. Written before the gateway is contacted and marked
-- used on completion, so a signature can never be replayed against a second
-- order and the client can never choose what it pays.
create table payment_intents (
  id             text primary key,            -- Razorpay order id, or a uuid for free grants
  user_id        uuid not null references auth.users (id) on delete cascade,
  product_id     text not null references products (id),
  product_type   product_type not null,
  product_title  text not null,
  base_price     numeric(10, 2) not null check (base_price >= 0),
  coupon_code    text references coupons (code),
  discount       numeric(10, 2) not null default 0 check (discount >= 0),
  amount         numeric(10, 2) not null check (amount >= 0),
  is_free        boolean not null default false,
  used           boolean not null default false,
  used_at        timestamptz,
  created_at     timestamptz not null default now(),
  constraint discount_within_price check (discount <= base_price)
);

create index payment_intents_user_idx on payment_intents (user_id, created_at desc);

create table orders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  product_id     text not null references products (id),
  product_title  text not null,
  product_type   product_type not null,
  user_name      text,
  email          text,
  phone          text,
  base_price     numeric(10, 2) not null check (base_price >= 0),
  discount       numeric(10, 2) not null default 0 check (discount >= 0),
  amount         numeric(10, 2) not null check (amount >= 0),
  coupon_code    text references coupons (code),
  status         order_status not null default 'paid',
  payment_mode   text,
  payment_ref    text,
  transaction_id text,
  transaction    jsonb not null default '{}'::jsonb,
  test_payment   boolean not null default false,
  shipping       jsonb not null default '{}'::jsonb,
  tracking_number text,
  admin_note     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index orders_user_idx on orders (user_id, created_at desc);
create index orders_status_idx on orders (status, created_at desc);

-- Replaces Firestore's transactions_index. The primary key is the gateway
-- payment id, so a duplicate webhook or double-submit collides on insert
-- instead of granting access twice.
create table transactions (
  id             text primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  order_id       uuid references orders (id) on delete set null,
  product_id     text references products (id),
  product_title  text,
  amount         numeric(10, 2) not null check (amount >= 0),
  currency       text not null default 'INR',
  status         text not null,
  gateway        text,
  method         text,
  test_payment   boolean not null default false,
  -- Gateway signature is intentionally NOT stored; it has no use after
  -- verification and is one more secret to leak.
  raw            jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index transactions_user_idx on transactions (user_id, created_at desc);

-- Entitlements. One row per user per product.
create table purchases (
  user_id        uuid not null references auth.users (id) on delete cascade,
  product_id     text not null references products (id),
  order_id       uuid references orders (id) on delete set null,
  title          text,
  type           product_type not null,
  language       text,
  image_url      text,
  price          numeric(10, 2) not null default 0 check (price >= 0),
  download_link  text,
  access_status  text not null default 'active',
  source         text not null default 'checkout',
  granted_by     uuid references auth.users (id),
  test_payment   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index purchases_user_idx on purchases (user_id, created_at desc);

-- ── Support ─────────────────────────────────────────────────────────────────

create table tickets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  order_id      uuid references orders (id) on delete set null,
  category      ticket_category not null default 'other',
  kind          text not null default 'support_request',
  issue         text not null,
  reason        text,
  product_type  product_type,
  email         text,
  name          text,
  status        ticket_status not null default 'open',
  admin_reply   text,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index tickets_user_idx on tickets (user_id, created_at desc);
create index tickets_open_idx on tickets (status, created_at desc);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  message     text not null,
  type        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Serves the newest-first, capped notification feed.
create index notifications_user_idx on notifications (user_id, created_at desc);

-- ── Chat ────────────────────────────────────────────────────────────────────

create table chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index chat_sessions_user_idx on chat_sessions (user_id, updated_at desc);

create table chat_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references chat_sessions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  tools_called text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- History loads are "latest N in this session", oldest-first after reversal.
create index chat_messages_session_idx on chat_messages (session_id, created_at desc);

-- ── Settings & audit ────────────────────────────────────────────────────────

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create table audit_logs (
  id          bigserial primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target      text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on audit_logs (created_at desc);

-- ── updated_at maintenance ──────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'products', 'coupons', 'orders', 'purchases',
    'tickets', 'chat_sessions'
  ]
  loop
    execute format(
      'create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================================
-- Row Level Security
--
-- Every table is deny-by-default. The service role bypasses RLS entirely, so
-- the backend keeps writing money and entitlement rows; these policies only
-- describe what a signed-in browser client may do for itself.
-- ============================================================================

alter table profiles         enable row level security;
alter table admins           enable row level security;
alter table products         enable row level security;
alter table coupons          enable row level security;
alter table payment_intents  enable row level security;
alter table orders           enable row level security;
alter table transactions     enable row level security;
alter table purchases        enable row level security;
alter table tickets          enable row level security;
alter table notifications    enable row level security;
alter table chat_sessions    enable row level security;
alter table chat_messages    enable row level security;
alter table app_settings     enable row level security;
alter table audit_logs       enable row level security;

-- Profiles: your own row, plus admin read. `blocked` is not in the client's
-- gift, so updates are constrained to the columns a person may edit.
create policy profiles_select_own on profiles
  for select using (id = auth.uid() or is_admin());

create policy profiles_insert_own on profiles
  for insert with check (id = auth.uid());

create policy profiles_update_own on profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and blocked = (select p.blocked from profiles p where p.id = auth.uid())
  );

-- Admins: read your own membership to render admin UI. No client writes.
create policy admins_select_self on admins
  for select using (user_id = auth.uid());

-- Catalog: public read of sellable stock; admins see everything.
create policy products_public_read on products
  for select using ((enabled and not retired) or is_admin());

create policy products_admin_write on products
  for all using (is_admin()) with check (is_admin());

-- Coupons: never publicly readable — listing them hands out every discount
-- code. Validation goes through the backend, which applies the rules.
create policy coupons_admin_all on coupons
  for all using (is_admin()) with check (is_admin());

-- Money and entitlements: read-only for the owner, writable only by the
-- service role (which bypasses RLS). No insert/update/delete policy exists
-- for clients on any of these, so those verbs are denied outright.
create policy payment_intents_select_own on payment_intents
  for select using (user_id = auth.uid() or is_admin());

create policy orders_select_own on orders
  for select using (user_id = auth.uid() or is_admin());

create policy transactions_select_own on transactions
  for select using (user_id = auth.uid() or is_admin());

create policy purchases_select_own on purchases
  for select using (user_id = auth.uid() or is_admin());

-- Tickets: raise your own and read your own; only staff resolve them.
create policy tickets_select_own on tickets
  for select using (user_id = auth.uid() or is_admin());

create policy tickets_insert_own on tickets
  for insert with check (user_id = auth.uid());

create policy tickets_admin_update on tickets
  for update using (is_admin()) with check (is_admin());

-- Notifications: read your own and toggle `read`. Content stays backend-owned,
-- so the update policy pins every other column to its existing value.
create policy notifications_select_own on notifications
  for select using (user_id = auth.uid() or is_admin());

create policy notifications_mark_read on notifications
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and title = (select n.title from notifications n where n.id = notifications.id)
    and message = (select n.message from notifications n where n.id = notifications.id)
  );

create policy notifications_admin_write on notifications
  for all using (is_admin()) with check (is_admin());

-- Chat: your own transcript.
create policy chat_sessions_own on chat_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy chat_messages_own on chat_messages
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Settings: public read (store config drives the storefront), admin write.
create policy app_settings_public_read on app_settings
  for select using (true);

create policy app_settings_admin_write on app_settings
  for all using (is_admin()) with check (is_admin());

-- Audit log: admin read only. Writes come from the service role.
create policy audit_logs_admin_read on audit_logs
  for select using (is_admin());

-- ── New-signup profile row ──────────────────────────────────────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
