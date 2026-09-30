import { ApiClientError } from "@pvg/api-client";

function messageFromUnknown(err: unknown): string | null {
  if (typeof err === "string" && err.trim()) return err.trim();
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
    if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
  }
  return null;
}

/** Map transport / API failures to safe, user-facing copy (no secrets/host dumps). */
export function toSafeAuthError(err: unknown): string {
  if (err instanceof ApiClientError) {
    const status = err.status;
    const code = err.apiError.code?.toLowerCase() ?? "";
    const msg = (err.apiError.message || "").toLowerCase();

    if (status === 401 || code.includes("unauthorized") || msg.includes("invalid email")) {
      return "Email or password is incorrect.";
    }
    if (status === 403) {
      if (msg.includes("verif")) {
        return "Verify your email before signing in, or resend the verification link.";
      }
      return "Access denied. Check your account status or try again.";
    }
    if (status === 409 || code.includes("conflict") || msg.includes("already exists")) {
      return "An account with this email already exists.";
    }
    if (status === 429 || code.includes("rate")) {
      return "Too many sign-in attempts. Please wait a moment and try again.";
    }
    if (status >= 500) {
      return "PVG AI is temporarily unavailable.";
    }
    if (err.apiError.message && err.apiError.message.length < 160) {
      return err.apiError.message;
    }
    return "Sign-in could not be completed. Please try again.";
  }

  // Tauri invoke often rejects with a bare string / plain object.
  const raw = messageFromUnknown(err);
  if (raw) {
    const m = raw.toLowerCase();
    if (m.includes("invalid email") || m.includes("unauthorized") || m.includes("incorrect")) {
      return "Email or password is incorrect.";
    }
    if (/failed to fetch|networkerror|load failed|network|unreachable|connection/i.test(m)) {
      return "Unable to connect to PVG AI.";
    }
    if (m.includes("ssl") || m.includes("tls") || m.includes("certificate")) {
      return "Secure connection to PVG AI could not be established.";
    }
    if (/localhost|127\.0\.0\.1|stack|exception|sql|vault|keyring|secret service/i.test(raw)) {
      // Vault/keyring failures must never look like bad credentials.
      if (/vault|keyring|secret service/i.test(m)) {
        return "Signed in, but secure session storage is unavailable on this device. You may need to sign in again after restart.";
      }
      return "Unable to connect to PVG AI.";
    }
    if (raw.length < 160) return raw;
  }

  if (err instanceof TypeError || (err instanceof Error && /failed to fetch|networkerror|load failed|fetch/i.test(err.message))) {
    return "Unable to connect to PVG AI.";
  }

  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    if (m.includes("ssl") || m.includes("tls") || m.includes("certificate")) {
      return "Secure connection to PVG AI could not be established.";
    }
    if (m.includes("failed to fetch") || m.includes("network")) {
      return "Unable to connect to PVG AI.";
    }
    if (/localhost|127\.0\.0\.1|stack|exception|sql/i.test(err.message)) {
      return "Unable to connect to PVG AI.";
    }
    if (err.message.length < 160) return err.message;
  }

  return "Sign-in failed. Please try again.";
}

export function toSafeSignupError(err: unknown): string {
  if (err instanceof ApiClientError) {
    const status = err.status;
    const msg = (err.apiError.message || "").toLowerCase();
    if (status === 409 || msg.includes("already exists")) {
      return "An account with this email already exists.";
    }
    if (status === 422 || status === 400) {
      return err.apiError.message?.slice(0, 160) || "Check your details and try again.";
    }
    if (status >= 500) return "PVG AI is temporarily unavailable.";
  }
  return toSafeAuthError(err);
}
