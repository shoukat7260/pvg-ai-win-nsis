const STORAGE_KEY = "pvg.web.device_fp";

/** Stable browser device fingerprint for /auth/login device upsert. */
export function getWebDeviceFingerprint(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `web-${crypto.randomUUID()}`
        : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return `web-ephemeral-${Date.now()}`;
  }
}

export function getWebDeviceName(): string {
  if (typeof navigator === "undefined") return "Web Browser";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge Web";
  if (/Chrome\//.test(ua)) return "Chrome Web";
  if (/Firefox\//.test(ua)) return "Firefox Web";
  if (/Safari\//.test(ua)) return "Safari Web";
  return "Web Browser";
}
