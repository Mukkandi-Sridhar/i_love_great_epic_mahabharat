export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export const jsonHeaders = () => ({
  "Content-Type": "application/json",
});

export const adminHeaders = () => {
  const secret = import.meta.env.VITE_ADMIN_SECRET;
  return {
    "Content-Type": "application/json",
    ...(secret ? { "X-Admin-Secret": secret } : {}),
  };
};
