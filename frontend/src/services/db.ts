import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, arrayUnion } from "firebase/firestore";
import { FALLBACK_PRODUCTS, Product } from "@/data/products";
import { log } from "./logger";

export type ProductType = "ebook" | "sdcard" | "pendrive";

export interface PurchaseAccess {
  id: string;
  productId?: string;
  product_id?: string;
  type?: ProductType;
  title?: string | null;
  price?: number | null;
  imageUrl?: string | null;
  orderId?: string | null;
  status?: string;
  accessStatus?: string;
  downloadLink?: string | null;
  driveLink?: string | null;
  createdAt?: any;
}

const fallbackById = new Map(FALLBACK_PRODUCTS.map((product) => [product.id, product]));

const normalizeHighlights = (value: any, fallback?: Product) => {
  const highlights = Array.isArray(value) ? value : fallback?.highlights || [];
  return highlights.map((item: any) => {
    if (typeof item === "string") return { icon: "check", text: item };
    return item;
  });
};

const normalizeProduct = (id: string, data: Record<string, any>): Product => {
  const fallback = fallbackById.get(id);
  return {
    ...(fallback || {
      id,
      image: "",
      title: "",
      subtitle: "",
      rating: 0,
      reviewCount: 0,
      price: 0,
      originalPrice: 0,
      tag: "",
      type: "ebook" as const,
      language: "",
      totalSales: 0,
      description: "",
      highlights: [],
    }),
    ...data,
    id,
    image: data.image || data.imageUrl || fallback?.image || "",
    highlights: normalizeHighlights(data.highlights, fallback),
  } as Product;
};

export const fetchProducts = async (): Promise<Product[]> => {
  log.info("fetchProducts");
  try {
    const snap = await getDocs(collection(db, "products"));
    return snap.docs.map((d) => normalizeProduct(d.id, d.data() as Record<string, any>));
  } catch (err) {
    log.error("Error fetching products", err);
    return [];
  }
};

export const subscribeToProducts = (callback: (products: Product[]) => void) => {
  log.info("subscribeToProducts");
  try {
    return onSnapshot(
      collection(db, "products"),
      (snap) => {
        callback(snap.docs.map((d) => normalizeProduct(d.id, d.data() as Record<string, any>)));
      },
      (err) => {
        log.error("Error subscribing to products", err);
        callback([]);
      }
    );
  } catch (err) {
    log.error("Error starting product subscription", err);
    callback([]);
    return () => {};
  }
};

export const updateUserProfile = async (
  userId: string,
  data: { name?: string; email?: string; phone?: string }
) => {
  log.info("updateUserProfile", { userId, data });
  const userRef = doc(db, "users", userId);
  await setDoc(userRef, {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const getUserProfile = async (userId: string) => {
  log.info("getUserProfile", { userId });
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? (snap.data() as any) : null;
};



export const fetchOwnedProductIds = async (userId: string) => {
  log.info("fetchOwnedProductIds", { userId });
  const purchasesCol = collection(db, "users", userId, "purchases");
  const snap = await getDocs(purchasesCol);
  const ids = new Set<string>();
  snap.forEach((d) => ids.add((d.data() as any).productId ?? d.id));
  return ids;
};

/**
 * Real-time listener for owned product IDs
 */
export const subscribeToOwnedProductIds = (userId: string, callback: (ids: Set<string>) => void) => {
  log.info("subscribeToOwnedProductIds", { userId });
  const purchasesCol = collection(db, "users", userId, "purchases");
  return onSnapshot(purchasesCol, (snap) => {
    const ids = new Set<string>();
    snap.forEach((d) => ids.add((d.data() as any).productId ?? d.id));
    callback(ids);
  }, (err) => {
    log.error("Error subscribing to owned products", err);
  });
};

/**
 * Real-time listener for one product access document.
 */
export const subscribeToPurchaseAccess = (
  userId: string,
  productId: string,
  callback: (purchase: PurchaseAccess | null) => void,
  onError?: (err: unknown) => void
) => {
  log.info("subscribeToPurchaseAccess", { userId, productId });
  const purchaseRef = doc(db, "users", userId, "purchases", productId);
  return onSnapshot(
    purchaseRef,
    (snap) => {
      callback(snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as PurchaseAccess) : null);
    },
    (err) => {
      log.error("Error subscribing to purchase access", err);
      onError?.(err);
    }
  );
};

export const fetchPurchases = async (userId: string) => {
  log.info("fetchPurchases", { userId });
  const purchasesCol = collection(db, "users", userId, "purchases");
  const snap = await getDocs(purchasesCol);
  const items: Array<{ id: string; productId: string; type: ProductType; title?: string | null; price?: number | null; imageUrl?: string | null; createdAt?: any }> = [];
  snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
  return items;
};

/**
 * Real-time listener for all purchases
 */
export const subscribeToPurchases = (userId: string, callback: (items: any[]) => void) => {
  log.info("subscribeToPurchases", { userId });
  const purchasesCol = collection(db, "users", userId, "purchases");
  return onSnapshot(purchasesCol, (snap) => {
    const items: any[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
    callback(items);
  }, (err) => {
    log.error("Error subscribing to purchases", err);
  });
};



export interface NotificationItem { id?: string; title: string; message: string; createdAt: any; read?: boolean; type?: string }

// Notifications accumulate indefinitely (every order, shipment, ticket reply
// and admin broadcast adds one), so every read is capped rather than pulling
// the user's whole history on each visit.
const NOTIFICATION_PAGE_SIZE = 50;

export const fetchNotifications = async (userId: string) => {
  const q = query(
    collection(db, "users", userId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(NOTIFICATION_PAGE_SIZE)
  );
  const snap = await getDocs(q);
  const items: NotificationItem[] = [];
  snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
  return items;
};

export const subscribeToNotifications = (
  userId: string,
  callback: (items: NotificationItem[]) => void,
  onError?: (err: unknown) => void
) => {
  const q = query(
    collection(db, "users", userId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(NOTIFICATION_PAGE_SIZE)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: NotificationItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
      callback(items);
    },
    (err) => {
      log.error("Error subscribing to notifications", err);
      onError?.(err);
    }
  );
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  await setDoc(doc(db, "users", userId, "notifications", notificationId), { read: true }, { merge: true });
};

export const markAllNotificationsRead = async (userId: string, notifications: NotificationItem[]) => {
  const unread = notifications.filter((item) => item.id && !item.read);
  if (unread.length === 0) return;
  await Promise.all(unread.map((item) => markNotificationRead(userId, item.id!)));
};
