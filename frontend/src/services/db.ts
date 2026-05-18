import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, addDoc, arrayUnion } from "firebase/firestore";
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

export interface OrderInput {
  userId: string;
  phone: string;
  items: Array<{ id: string; type: ProductType; price: number; title: string }>;
  total: number;
  status: "pending" | "paid" | "cod" | "shipped" | "delivered";
  paymentRef?: string | null;
  shipping?: {
    name?: string;
    address?: string;
    city?: string;
    pincode?: string;
    state?: string;
    altPhone?: string;
    instagramId?: string;
  };
}

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



export const createOrder = async (data: OrderInput) => {
  log.info("createOrder", data);
  // New Path: users/{userId}/orders
  const ref = await addDoc(collection(db, "users", data.userId, "orders"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const addPurchase = async (
  userId: string,
  productId: string,
  type: ProductType,
  options?: { title?: string; price?: number; imageUrl?: string }
) => {
  log.info("addPurchase", { userId, productId, type, options });
  const purchasesCol = collection(db, "users", userId, "purchases");
  // Use productId as document id so each user has at most one purchase doc per product
  await setDoc(doc(purchasesCol, productId), {
    productId,
    type,
    title: options?.title ?? null,
    price: options?.price ?? null,
    imageUrl: options?.imageUrl ?? null,
    createdAt: serverTimestamp(),
  });
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



export interface NotificationItem { id?: string; title: string; message: string; createdAt: any; read?: boolean }

export const fetchNotifications = async (userId: string) => {
  // New Path: users/{userId}/notifications
  const q = query(collection(db, "users", userId, "notifications"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const items: NotificationItem[] = [];
  snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
  return items;
};
