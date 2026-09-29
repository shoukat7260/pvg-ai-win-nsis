import type { MediaAsset, PreviewSource, ProjectAssetDto } from "@/types";
import { getMediaBlobUrl } from "@/services/mediaBlobRegistry";
import { isBrowserPreview } from "@/lib/paths";
import { nativeApi } from "@/services/tauri";

export type MediaPreviewKind = "video" | "audio" | "image" | "unknown";

export interface MediaPreviewResolved {
  url: string | null;
  kind: MediaPreviewKind;
  transport: "blob" | "asset" | "none";
  reason?: string;
  posterUrl?: string | null;
}

function kindFromAsset(kind: string | undefined): MediaPreviewKind {
  const k = (kind ?? "").toLowerCase();
  if (k === "video" || k === "audio" || k === "image") return k;
  return "unknown";
}

/**
 * Resolve a playable/display URL for an asset.
 * Priority: in-memory blob (browser File pick) → Tauri convertFileSrc after native resolve.
 * Never returns raw absolute Windows/Unix paths for use as <video src> in browser.
 */
export async function resolveMediaPreviewUrl(args: {
  projectPath: string;
  assetId: string;
  asset?: MediaAsset | ProjectAssetDto | null;
  previewSource?: PreviewSource;
}): Promise<MediaPreviewResolved> {
  const { projectPath, assetId, asset, previewSource = "auto" } = args;
  const kind = kindFromAsset(
    asset && "kind" in asset ? String(asset.kind) : undefined,
  );

  const blob = getMediaBlobUrl(assetId);
  if (blob) {
    return { url: blob, kind, transport: "blob", posterUrl: null };
  }

  if (isBrowserPreview()) {
    return {
      url: null,
      kind,
      transport: "none",
      reason:
        "Browser preview needs a File-picker import (blob URL). Re-import the media in this session, or use the Tauri desktop shell for linked/copied disk paths.",
    };
  }

  try {
    const resolved = await nativeApi.mediaResolvePreview({
      projectPath,
      assetId,
      preferProxy: previewSource === "proxy" || previewSource === "auto",
      forceOriginal: previewSource === "original",
    });
    if (!resolved?.absolutePath) {
      return {
        url: null,
        kind,
        transport: "none",
        reason: resolved?.error ?? "Preview path unavailable",
      };
    }
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const url = convertFileSrc(resolved.absolutePath);
    return {
      url,
      kind: kindFromAsset(resolved.kind) || kind,
      transport: "asset",
      posterUrl: resolved.posterPath
        ? convertFileSrc(resolved.posterPath)
        : null,
    };
  } catch (err) {
    return {
      url: null,
      kind,
      transport: "none",
      reason: err instanceof Error ? err.message : "Failed to resolve preview",
    };
  }
}
