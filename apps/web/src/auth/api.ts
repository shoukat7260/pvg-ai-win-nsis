import { createApiClient, type PvgApiClient } from "@pvg/api-client";
import { getAccessToken } from "./tokenMemory";

/**
 * SPA auth pattern (Phase 2):
 * - Access JWT: in-memory only (Authorization header via getAccessToken).
 * - Refresh: prefer HttpOnly Secure SameSite cookie from the API (credentials: "include"
 *   when VITE_AUTH_COOKIE_MODE=true). Otherwise refresh token stays out of localStorage;
 *   short-lived sessions re-auth on reload until cookie mode is enabled.
 * - Never persist tokens in Zustand persist / localStorage / sessionStorage.
 */
const API_BASE =
  import.meta.env.VITE_API_PUBLIC_URL?.replace(/\/$/, "") || "http://localhost:8000";

const COOKIE_MODE = import.meta.env.VITE_AUTH_COOKIE_MODE === "true";

let client: PvgApiClient | null = null;

export function getApiClient(): PvgApiClient {
  if (!client) {
    client = createApiClient({
      baseUrl: API_BASE,
      getAccessToken: () => getAccessToken(),
      credentials: COOKIE_MODE ? "include" : "same-origin",
    });
  }
  return client;
}

export function resetApiClient(): void {
  client = null;
}
