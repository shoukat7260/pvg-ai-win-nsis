import { isTauriRuntime } from "@/lib/paths";

type FetchLike = typeof globalThis.fetch;

let cachedFetch: FetchLike | null = null;

/**
 * In the packaged Tauri WebView, use the HTTP plugin so API calls:
 * - do not depend on WebView CSP connect-src / mixed-content rules
 * - are constrained by Tauri capability URL scope (not an open wildcard)
 * Browser / Vite preview continues to use window.fetch.
 */
export async function getDesktopFetch(): Promise<FetchLike> {
  if (cachedFetch) return cachedFetch;
  if (isTauriRuntime()) {
    const mod = await import("@tauri-apps/plugin-http");
    cachedFetch = mod.fetch as unknown as FetchLike;
    return cachedFetch;
  }
  cachedFetch = globalThis.fetch.bind(globalThis);
  return cachedFetch;
}

/** Test helper */
export function resetDesktopFetchCache(): void {
  cachedFetch = null;
}
