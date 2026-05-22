import { auth } from "@/lib/firebase";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

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
