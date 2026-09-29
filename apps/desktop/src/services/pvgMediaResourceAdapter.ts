import type {
  MediaResourceHandle,
  MediaResourceRequest,
  PvgMediaResourceResolver,
} from "@pvg/opencut-integration";
import { resolveMediaPreviewUrl } from "@/services/mediaPreview";
import { useEditorStore } from "@/state/editorStore";

function kindFromString(kind: string | undefined): MediaResourceHandle["kind"] {
  const k = (kind ?? "").toLowerCase();
  if (k === "video" || k === "audio" || k === "image") return k;
  return "other";
}

/** Scoped resolver: asset_id → authorized playback URL (no arbitrary paths). */
export const pvgMediaResourceAdapter: PvgMediaResourceResolver = {
  async resolve(request: MediaResourceRequest): Promise<MediaResourceHandle> {
    const state = useEditorStore.getState();
    const project = state.project;
    const asset = project?.assets.find((a) => a.id === request.assetId) ?? null;
    const preview = await resolveMediaPreviewUrl({
      projectPath: request.projectPath,
      assetId: request.assetId,
      asset,
      previewSource: request.previewSource ?? "auto",
    });
    return {
      assetId: request.assetId,
      kind: kindFromString(asset?.kind),
      playbackUrl: preview.url,
      posterUrl: preview.posterUrl ?? null,
      availability: asset?.availability ?? "missing",
      usesProxy: preview.transport === "asset" && (request.previewSource === "proxy" || request.previewSource === "auto"),
      transport: preview.transport,
      reason: preview.reason,
    };
  },
};
