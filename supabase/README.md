# Supabase migration

Status: **schema only.** The application still runs entirely on Firebase.
Nothing here is wired into the app yet, so applying this migration changes
nothing for customers.

## What exists

`migrations/0001_initial_schema.sql` — the full Postgres port of the Firestore
model: tables, enums, indexes, `updated_at` triggers, Row Level Security
policies, and a trigger that creates a `profiles` row on signup.

It was applied against a real PostgreSQL 15 instance and the policies were
exercised, not just written. Verified behaviour:

| Attempt (as a signed-in, non-admin user)   | Result  |
| ------------------------------------------ | ------- |
| Read another user's orders / purchases / notifications | 0 rows |
| Read their own orders / purchases           | works   |
| Insert a purchase for themselves            | blocked |
| Insert a paid order for themselves          | blocked |
| Insert themselves into `admins`             | blocked |
| Update a product's price                    | no change |
| Create a 100%-off coupon                    | blocked |
| List coupons                                | 0 rows  |
| Mark their own notification read            | works   |
| Rewrite that notification's message         | blocked |
| Unblock themselves on `profiles`            | blocked |
| See a `retired` product                     | hidden (admin sees it) |

## Design rules carried over from the Firestore hardening

1. **Money and entitlements are service-role only.** `orders`, `purchases`,
   `transactions` and `payment_intents` have *no* client insert/update policy,
   so those verbs are denied outright. Clients read their own rows; the backend
   writes them.
2. **Admin status is not a user-editable column.** It lives in `admins`, which
   no client can write. `profiles.is_admin` deliberately does not exist — a
   self-serve boolean there was the privilege-escalation path removed from the
   Firestore rules.
3. **Coupons are not publicly readable.** Listing them would hand out every
   discount code; validation goes through the backend.
4. **Gateway signatures are not stored.** They have no use after verification
   and are one more secret to leak.

## Applying it

```bash
supabase db push
```

Or paste the file into the Supabase SQL editor. It is idempotent only on a
fresh database — re-running against a populated one will fail on existing
types and tables.

## Not done yet

The cutover is the large part and is not started:

- Auth migration (Firebase Auth → Supabase Auth), including re-mapping every
  user id that `orders`, `purchases` and `tickets` reference.
- Data export/import from Firestore.
- Rewriting `frontend/src/services/db.ts`, `lib/firebase.ts` and the auth
  context against `@supabase/supabase-js`.
- Rewriting the backend's Firestore access (`core/firebase.py`, `mcp/server.py`,
  `main.py`, `api/*.py`, `agent/memory.py`) against Postgres.
- Storage migration, if Firebase Storage holds any live assets.

**Blocker:** the Firebase service account key was disabled by Google after the
credential leak, so Firestore data cannot currently be exported at all. A new
key has to be issued before any data migration can begin.
