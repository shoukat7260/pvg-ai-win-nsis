import { nativeApi } from "./tauri";
import type { ProjectMetadata } from "@/types";

export const projectService = {
  /** Flat project list for UI grids (active, not trashed). */
  list: async (): Promise<ProjectMetadata[]> => {
    const result = await nativeApi.listWorkspaceProjects();
    return (result.projects ?? []).filter((p) => !p.trashed);
  },
  listTrash: async (): Promise<ProjectMetadata[]> => {
    const result = await nativeApi.listTrashedProjects();
    return result.projects ?? [];
  },
  listWithRoot: () => nativeApi.listWorkspaceProjects(),
  create: (name: string, workspaceId: string, description = "") =>
    nativeApi.createProject({ name, workspaceId, description }),
  open: (path: string) => nativeApi.openProject(path),
  readMetadata: (path: string) => nativeApi.readProjectMetadata(path),
  rename: (path: string, name: string) => nativeApi.renameProject(path, name),
  duplicate: (path: string, name?: string) => nativeApi.duplicateProject(path, name),
  trash: (path: string) => nativeApi.trashProject(path),
  restore: (path: string) => nativeApi.restoreProject(path),
  deletePermanent: (path: string) => nativeApi.deleteProjectPermanent(path),
  generateThumbnail: (path: string, sourcePath?: string) =>
    nativeApi.generateProjectThumbnail(path, sourcePath),
};
