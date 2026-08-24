import { auth } from "@/lib/firebase";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "https://ilgem-backend-y0m3.onrender.com";

export const jsonHeaders = () => ({
  "Content-Type": "application/json",
});

export const authHeaders = async () => {
  const token = await auth?.currentUser?.getIdToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const adminHeaders = authHeaders;

/**
 * Rebuild the AI product index from Firestore.
 *
 * Catalog edits are written straight to Firestore, so without this the
 * assistant cannot semantically find newly added products. Prices and stock
 * are read live at query time, so this only matters for search coverage —
 * failures are surfaced to the caller but are never fatal to the save itself.
 */
export const refreshProductIndex = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/rag/refresh`, {
      method: "POST",
      headers: await adminHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
};
