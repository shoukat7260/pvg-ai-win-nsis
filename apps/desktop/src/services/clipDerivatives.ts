import { isBrowserPreview } from "@/lib/paths";
import { getMediaBlobUrl } from "@/services/mediaBlobRegistry";
import type { ProjectAsset } from "@pvg/project-format";

export type ClipDerivativeVisual = {
  thumbnailUrl: string | null;
  waveformUrl: string | null;
  hasProxy: boolean;
  missing: boolean;
};

/**
 * Resolve Phase 3 derivative URLs for timeline filmstrip / waveform.
 * Never exposes arbitrary filesystem paths — uses convertFileSrc or blob registry.
 */
export async function resolveClipDerivatives(args: {
  projectPath: string | null;
  asset: ProjectAsset | null | undefined;
}): Promise<ClipDerivativeVisual> {
  const { projectPath, asset } = args;
  if (!asset) {
    return { thumbnailUrl: null, waveformUrl: null, hasProxy: false, missing: true };
  }
  const missing =
    asset.availability === "missing" || asset.availability === "inaccessible";
  const hasProxy = Boolean(asset.proxy);

  if (isBrowserPreview()) {
    const blob = getMediaBlobUrl(asset.id);
    return {
      thumbnailUrl: blob,
      waveformUrl: null,
      hasProxy,
      missing: missing && !blob,
    };
  }

  if (!projectPath) {
    return { thumbnailUrl: null, waveformUrl: null, hasProxy, missing };
  }

  let thumbnailUrl: string | null = null;
  let waveformUrl: string | null = null;
  try {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    if (asset.thumbnail?.relativePath) {
      thumbnailUrl = convertFileSrc(
        joinProjectPath(projectPath, asset.thumbnail.relativePath),
      );
    }
    if (asset.waveform?.relativePath) {
      waveformUrl = convertFileSrc(
        joinProjectPath(projectPath, asset.waveform.relativePath),
      );
    }
  } catch {
    /* outside Tauri */
  }

  return { thumbnailUrl, waveformUrl, hasProxy, missing };
}

function joinProjectPath(projectPath: string, relative: string): string {
  const base = projectPath.replace(/[/\\]+$/, "");
  const rel = relative.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  if (base.includes("\\")) return `${base}\\${rel.replace(/\//g, "\\")}`;
  return `${base}/${rel}`;
}
