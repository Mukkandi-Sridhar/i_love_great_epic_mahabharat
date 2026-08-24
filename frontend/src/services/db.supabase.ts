import { supabase } from "@/lib/supabase";
import { log } from "@/services/logger";
import { Product, FALLBACK_PRODUCTS } from "@/data/products";
import { RETIRED_PRODUCT_TYPES } from "@/services/db";

/**
 * Supabase data access for the storefront.
 *
 * Mirrors the exported surface of services/db.ts so pages can switch backend
 * without changing their own logic. Every query here runs under the anon key
 * and is therefore subject to Row Level Security: a user simply cannot read
 * another user's rows, and cannot write orders, purchases or coupons at all.
 * Ownership filters are still written explicitly so intent is visible at the
 * call site rather than resting on policy alone.
 */

const client = () => {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
};

const normalizeProduct = (row: any): Product => ({
  id: row.id,
  title: row.title ?? "",
  subtitle: row.subtitle ?? "",
  description: row.description ?? "",
  type: row.type,
  language: row.language ?? "",
  price: Number(row.price ?? 0),
  originalPrice: Number(row.original_price ?? row.price ?? 0),
  image: row.image ?? "",
  driveLink: row.drive_link ?? undefined,
  highlights: Array.isArray(row.highlights) ? row.highlights : [],
  rating: Number(row.rating ?? 0),
  reviewCount: Number(row.review_count ?? 0),
  totalSales: Number(row.total_sales ?? 0),
  stockCount: Number(row.stock_count ?? 0),
  isPhysical: Boolean(row.is_physical),
  tag: row.tag ?? "",
});

const isSellableRow = (row: any) => !RETIRED_PRODUCT_TYPES.has(String(row?.type ?? "").toLowerCase());

// ── Catalog ─────────────────────────────────────────────────────────────────

export const fetchProducts = async (): Promise<Product[]> => {
  try {
    const { data, error } = await client()
      .from("products")
      .select("*")
      .eq("enabled", true)
      .eq("retired", false)
      .order("type")
      .order("title");
    if (error) throw error;
    return (data ?? []).filter(isSellableRow).map(normalizeProduct);
  } catch (err) {
    log.error("Error fetching products", err);
    return FALLBACK_PRODUCTS;
  }
};

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  let cancelled = false;

  const load = async () => {
    const products = await fetchProducts();
    if (!cancelled) callback(products);
  };

  load();

  // Postgres changefeed: catalog edits reach open storefronts without a reload.
  const channel = client()
    .channel("products-stream")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, load)
    .subscribe();

  return () => {
    cancelled = true;
    client().removeChannel(channel);
  };
};

// ── Profile ─────────────────────────────────────────────────────────────────

export const getUserProfile = async (userId: string) => {
  const { data, error } = await client()
    .from("profiles")
    .select("id, email, name, phone")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    log.error("Error loading profile", error);
    return null;
  }
  return data;
};

export const updateUserProfile = async (
  userId: string,
  data: { name?: string; email?: string; phone?: string }
) => {
  // `blocked` is intentionally not updatable here, and the RLS policy rejects
  // an update that changes it even if one were sent.
  const { error } = await client().from("profiles").update(data).eq("id", userId);
  if (error) throw error;
};

// ── Entitlements ────────────────────────────────────────────────────────────

export const fetchPurchases = async (userId: string) => {
  const { data, error } = await client()
    .from("purchases")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    log.error("Error fetching purchases", error);
    return [];
  }
  return data ?? [];
};

export const subscribeToPurchases = (userId: string, callback: (items: any[]) => void) => {
  let cancelled = false;

  const load = async () => {
    const items = await fetchPurchases(userId);
    if (!cancelled) callback(items);
  };

  load();

  const channel = client()
    .channel(`purchases-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "purchases", filter: `user_id=eq.${userId}` },
      load
    )
    .subscribe();

  return () => {
    cancelled = true;
    client().removeChannel(channel);
  };
};

export const subscribeToOwnedProductIds = (
  userId: string,
  callback: (ids: Set<string>) => void
) =>
  subscribeToPurchases(userId, (items) =>
    callback(
      new Set(
        items
          .filter((item) => (item.access_status ?? "active") !== "revoked")
          .map((item) => item.product_id)
      )
    )
  );

export const subscribeToPurchaseAccess = (
  userId: string,
  productId: string,
  callback: (purchase: any | null) => void,
  onError?: (err: unknown) => void
) => {
  let cancelled = false;

  const load = async () => {
    const { data, error } = await client()
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();
    if (cancelled) return;
    if (error) {
      onError?.(error);
      return;
    }
    callback(
      data
        ? {
            id: data.product_id,
            productId: data.product_id,
            title: data.title,
            type: data.type,
            price: data.price,
            downloadLink: data.download_link,
            driveLink: data.download_link,
            accessStatus: data.access_status,
            status: data.access_status,
            orderId: data.order_id,
          }
        : null
    );
  };

  load();

  const channel = client()
    .channel(`purchase-${userId}-${productId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "purchases", filter: `user_id=eq.${userId}` },
      load
    )
    .subscribe();

  return () => {
    cancelled = true;
    client().removeChannel(channel);
  };
};

// ── Orders ──────────────────────────────────────────────────────────────────

export const fetchOrders = async (userId: string) => {
  const { data, error } = await client()
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    log.error("Error fetching orders", error);
    return [];
  }
  return data ?? [];
};

// ── Notifications ───────────────────────────────────────────────────────────

const NOTIFICATION_PAGE_SIZE = 50;

export interface NotificationItem {
  id?: string;
  title: string;
  message: string;
  createdAt: any;
  read?: boolean;
  type?: string;
}

const normalizeNotification = (row: any): NotificationItem => ({
  id: row.id,
  title: row.title,
  message: row.message,
  type: row.type ?? undefined,
  read: Boolean(row.read),
  createdAt: row.created_at,
});

export const fetchNotifications = async (userId: string): Promise<NotificationItem[]> => {
  const { data, error } = await client()
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATION_PAGE_SIZE);
  if (error) {
    log.error("Error fetching notifications", error);
    return [];
  }
  return (data ?? []).map(normalizeNotification);
};

export const subscribeToNotifications = (
  userId: string,
  callback: (items: NotificationItem[]) => void,
  onError?: (err: unknown) => void
) => {
  let cancelled = false;

  const load = async () => {
    try {
      const items = await fetchNotifications(userId);
      if (!cancelled) callback(items);
    } catch (err) {
      onError?.(err);
    }
  };

  load();

  const channel = client()
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      load
    )
    .subscribe();

  return () => {
    cancelled = true;
    client().removeChannel(channel);
  };
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  // Only `read` is sent; the RLS policy rejects an update that alters the
  // title or message, so notification content stays backend-owned.
  const { error } = await client()
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
};

export const markAllNotificationsRead = async (userId: string, notifications: NotificationItem[]) => {
  const unreadIds = notifications.filter((item) => item.id && !item.read).map((item) => item.id!);
  if (unreadIds.length === 0) return;
  const { error } = await client()
    .from("notifications")
    .update({ read: true })
    .in("id", unreadIds)
    .eq("user_id", userId);
  if (error) throw error;
};

// ── Support tickets ─────────────────────────────────────────────────────────

export const fetchTickets = async (userId: string) => {
  const { data, error } = await client()
    .from("tickets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    log.error("Error fetching tickets", error);
    return [];
  }
  return data ?? [];
};

export const createTicket = async (
  userId: string,
  input: { issue: string; category?: string; email?: string; name?: string }
) => {
  const { data, error } = await client()
    .from("tickets")
    .insert({
      user_id: userId,
      issue: input.issue,
      category: input.category ?? "other",
      email: input.email,
      name: input.name,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
};
