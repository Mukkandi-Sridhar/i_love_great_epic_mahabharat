export const log = {
  info: (msg: string, data?: any) => {
    write("info", `[INFO] ${msg}`, data);
  },
  warn: (msg: string, data?: any) => {
    write("warn", `[WARN] ${msg}`, data);
  },
  error: (msg: string, err?: any) => {
    write("error", `[ERROR] ${msg}`, err);
  },
  debug: (msg: string, data?: any) => {
    write("debug", `[DEBUG] ${msg}`, data);
  }
};

function write(level: "info" | "warn" | "error" | "debug", msg: string, data?: any) {
  if (import.meta?.env?.MODE === "production") return;

  try {
    globalThis.console?.[level]?.(msg, data ?? "");
  } catch {}
}
