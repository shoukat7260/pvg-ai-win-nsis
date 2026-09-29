/**
 * Browser-preview media blob registry.
 * Maps assetId → object URL created from File picker / drop.
 * Never stores filesystem paths for arbitrary disks — only user-selected Files.
 */

const blobs = new Map<string, { url: string; mime: string; name: string }>();

export function registerMediaBlob(assetId: string, file: File): string {
  revokeMediaBlob(assetId);
  const create =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL.bind(URL)
      : null;
  const url = create
    ? create(file)
    : `blob:pvg-fallback-${assetId}-${file.name}`;
  blobs.set(assetId, { url, mime: file.type || "application/octet-stream", name: file.name });
  return url;
}

export function getMediaBlobUrl(assetId: string): string | null {
  return blobs.get(assetId)?.url ?? null;
}

export function getMediaBlobMeta(
  assetId: string,
): { url: string; mime: string; name: string } | null {
  return blobs.get(assetId) ?? null;
}

export function revokeMediaBlob(assetId: string): void {
  const entry = blobs.get(assetId);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    blobs.delete(assetId);
  }
}

export function clearMediaBlobRegistry(): void {
  for (const id of [...blobs.keys()]) revokeMediaBlob(id);
}

/** Test helper */
export function mediaBlobRegistrySize(): number {
  return blobs.size;
}
