import type { ProjectAsset, MediaAvailability } from "@pvg/project-format";

export type PvgProjectAsset = ProjectAsset;

export type PreviewSourcePreference = "auto" | "proxy" | "original";

/** Canonical preview resolution request — asset_id is the only identity. */
export interface MediaResourceRequest {
  projectPath: string;
  assetId: string;
  previewSource?: PreviewSourcePreference;
}

/**
 * Resolved media resource for editor preview/timeline.
 * Implementations must not expose arbitrary filesystem roots to the webview.
 */
export interface MediaResourceHandle {
  assetId: string;
  kind: "video" | "audio" | "image" | "other";
  /** Webview-safe URL (blob:, asset:, or scoped convertFileSrc). */
  playbackUrl: string | null;
  posterUrl?: string | null;
  availability: MediaAvailability;
  usesProxy: boolean;
  transport: "blob" | "asset" | "none";
  reason?: string;
}

export interface PvgMediaResourceResolver {
  resolve(request: MediaResourceRequest): Promise<MediaResourceHandle>;
}

/** Map PVG asset → OpenCut-facing media descriptor (internal IDs only). */
export interface OpenCutMediaDescriptor {
  pvgAssetId: string;
  displayName: string;
  kind: MediaResourceHandle["kind"];
  durationMs: number | null;
}

export function toOpenCutMediaDescriptor(
  asset: PvgProjectAsset,
): OpenCutMediaDescriptor {
  const durationMs =
    asset.video?.durationMs ??
    asset.audio?.durationMs ??
    null;
  const kind =
    asset.kind === "video" || asset.kind === "audio" || asset.kind === "image"
      ? asset.kind
      : "other";
  return {
    pvgAssetId: asset.id,
    displayName: asset.name,
    kind,
    durationMs,
  };
}

/** Stable map when OpenCut internal media ids are introduced later. */
export type OpenCutMediaIdMap = Map<string, string>;

export function mapOpenCutMediaId(
  map: OpenCutMediaIdMap,
  pvgAssetId: string,
  openCutMediaId: string,
): void {
  map.set(pvgAssetId, openCutMediaId);
}

export function resolvePvgAssetIdFromOpenCut(
  map: OpenCutMediaIdMap,
  openCutMediaId: string,
): string | undefined {
  for (const [pvgId, ocId] of map.entries()) {
    if (ocId === openCutMediaId) return pvgId;
  }
  return undefined;
}
