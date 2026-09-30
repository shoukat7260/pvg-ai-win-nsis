/**
 * Authoritative desktop API configuration.
 * Packaged Windows builds MUST resolve to the production VPS API — never localhost.
 */

export type DesktopRuntimeEnvironment =
  | "development"
  | "test"
  | "staging"
  | "production";

/** Contabo VPS public API (this deployment). Override via VITE_API_PUBLIC_URL. */
export const PVG_PRODUCTION_API_BASE_URL = "http://62.171.139.173:8000";

/** Narrow allowlist used by Tauri HTTP plugin capabilities (must stay in sync). */
export const PVG_PRODUCTION_API_HTTP_SCOPE = [
  "http://62.171.139.173:8000/**",
  "http://62.171.139.173:8000/*",
] as const;

const DEV_API_BASE_URL = "http://127.0.0.1:8000";

function readEnv(name: string): string | undefined {
  if (typeof import.meta === "undefined") return undefined;
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const v = env?.[name];
  return typeof v === "string" && v.trim() ? v.trim().replace(/\/$/, "") : undefined;
}

export function resolveDesktopEnvironment(): DesktopRuntimeEnvironment {
  const explicit = readEnv("VITE_APP_ENV") ?? readEnv("MODE");
  if (
    explicit === "development" ||
    explicit === "test" ||
    explicit === "staging" ||
    explicit === "production"
  ) {
    return explicit;
  }
  // Vite sets PROD=true for production builds.
  const prod = (import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD;
  return prod ? "production" : "development";
}

/**
 * Single source of truth for the desktop API origin.
 * Production never falls back to localhost.
 */
export function getDesktopApiBaseUrl(): string {
  const fromEnv = readEnv("VITE_API_PUBLIC_URL");
  const environment = resolveDesktopEnvironment();

  if (fromEnv) {
    if (
      environment === "production" &&
      /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(fromEnv)
    ) {
      // Refuse to ship a production binary pointed at loopback.
      return PVG_PRODUCTION_API_BASE_URL;
    }
    return fromEnv;
  }

  switch (environment) {
    case "production":
      return PVG_PRODUCTION_API_BASE_URL;
    case "staging":
      return PVG_PRODUCTION_API_BASE_URL;
    case "test":
    case "development":
    default:
      return DEV_API_BASE_URL;
  }
}

export function getDesktopWebOrigin(): string {
  const fromEnv = readEnv("VITE_WEB_ORIGIN");
  const environment = resolveDesktopEnvironment();
  if (fromEnv) {
    if (
      environment === "production" &&
      /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:|\/|$)/i.test(fromEnv)
    ) {
      return "http://vmi3284028.contaboserver.net";
    }
    return fromEnv;
  }
  return environment === "production"
    ? "http://vmi3284028.contaboserver.net"
    : "http://localhost:5173";
}

export const desktopApiConfig = {
  get environment() {
    return resolveDesktopEnvironment();
  },
  get apiBaseUrl() {
    return getDesktopApiBaseUrl();
  },
  get webOrigin() {
    return getDesktopWebOrigin();
  },
  apiVersionPrefix: "/api/v1" as const,
  productionApiBaseUrl: PVG_PRODUCTION_API_BASE_URL,
};
