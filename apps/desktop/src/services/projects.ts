import { nativeApi } from "./tauri";

export const projectService = {
  list: () => nativeApi.listWorkspaceProjects(),
  create: (name: string, workspaceId: string, description = "") =>
    nativeApi.createProject({ name, workspaceId, description }),
  open: (path: string) => nativeApi.openProject(path),
  readMetadata: (path: string) => nativeApi.readProjectMetadata(path),
};
