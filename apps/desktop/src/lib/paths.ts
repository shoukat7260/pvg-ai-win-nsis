/** Safe path helpers for UI display only — validation lives in Rust. */

export function displayPath(path: string, max = 64): string {
  if (path.length <= max) return path;
  const head = Math.floor((max - 3) / 2);
  const tail = max - 3 - head;
  return `${path.slice(0, head)}...${path.slice(-tail)}`;
}

export function isBrowserPreview(): boolean {
  return typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);
}
