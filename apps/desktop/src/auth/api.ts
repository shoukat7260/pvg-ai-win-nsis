import { createApiClient, type PvgApiClient } from "@pvg/api-client";
import { getAccessToken } from "./tokenMemory";

const DEFAULT_API =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_API_PUBLIC_URL) ||
  "http://localhost:8000";

let client: PvgApiClient | null = null;

export function getApiClient(): PvgApiClient {
  if (!client) {
    client = createApiClient({
      baseUrl: DEFAULT_API,
      getAccessToken: () => getAccessToken(),
      credentials: "omit",
    });
  }
  return client;
}

export function resetApiClient(): void {
  client = null;
}
