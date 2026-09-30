import type { ProjectAsset, ProjectDocument } from "@pvg/project-format";

/**
 * Assets whose local path is missing/empty or already marked unavailable.
 * Does not fail project open — callers show a non-blocking relink banner.
 */
export function assetsWithMissingLocalPaths(
  assets: ProjectAsset[] | undefined | null,
): ProjectAsset[] {
  if (!assets?.length) return [];
  return assets.filter((asset) => {
    const avail = (asset.availability ?? "").toLowerCase();
    if (avail === "missing" || avail === "inaccessible") return true;

    if (asset.location?.mode === "link") {
      return !asset.location.absolutePath?.trim();
    }

    if (asset.location?.mode === "copy") {
      return !asset.location.relativePath?.trim();
    }

    return !asset.relativePath?.trim();
  });
}

export function projectHasMissingMedia(project: ProjectDocument | null): boolean {
  return assetsWithMissingLocalPaths(project?.assets).length > 0;
}
