import { createApiClient, type PvgApiClient } from "@pvg/api-client";
import { getAccessToken } from "./tokenMemory";
import { desktopApiConfig } from "@/config/desktopApiConfig";
import { getDesktopFetch } from "@/config/desktopFetch";

let client: PvgApiClient | null = null;
let clientPromise: Promise<PvgApiClient> | null = null;

async function buildClient(): Promise<PvgApiClient> {
  const fetchImpl = await getDesktopFetch();
  return createApiClient({
    baseUrl: desktopApiConfig.apiBaseUrl,
    getAccessToken: () => getAccessToken(),
    credentials: "omit",
    fetch: fetchImpl,
  });
}

/** Sync accessor for non-auth callers; may use window.fetch until async warm-up. */
export function getApiClient(): PvgApiClient {
  if (client) return client;
  client = createApiClient({
    baseUrl: desktopApiConfig.apiBaseUrl,
    getAccessToken: () => getAccessToken(),
    credentials: "omit",
  });
  return client;
}

/** Preferred for auth — wires Tauri HTTP plugin in the packaged app. */
export function getApiClientAsync(): Promise<PvgApiClient> {
  if (!clientPromise) {
    clientPromise = buildClient().then((c) => {
      client = c;
      return c;
    });
  }
  return clientPromise;
}

export function resetApiClient(): void {
  client = null;
  clientPromise = null;
}

export function getConfiguredApiBaseUrl(): string {
  return desktopApiConfig.apiBaseUrl;
}
