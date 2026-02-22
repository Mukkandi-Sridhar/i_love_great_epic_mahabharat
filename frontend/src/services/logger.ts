export const log = {
  info: (msg: string, data?: any) => {
    try { console.info(`[INFO] ${msg}`, data ?? ""); } catch {}
  },
  warn: (msg: string, data?: any) => {
    try { console.warn(`[WARN] ${msg}`, data ?? ""); } catch {}
  },
  error: (msg: string, err?: any) => {
    try { console.error(`[ERROR] ${msg}`, err ?? ""); } catch {}
  },
  debug: (msg: string, data?: any) => {
    if (import.meta?.env?.MODE !== "production") {
      try { console.debug(`[DEBUG] ${msg}`, data ?? ""); } catch {}
    }
  }
};
