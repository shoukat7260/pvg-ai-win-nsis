/**
 * Foundation permission constants and role → permission mapping.
 * Deny by default when a permission is missing for a role.
 */

export const PERMISSIONS = {
  WORKSPACE_READ: "workspace.read",
  WORKSPACE_WRITE: "workspace.write",
  WORKSPACE_MANAGE_MEMBERS: "workspace.manage_members",
  PROJECT_READ: "project.read",
  PROJECT_WRITE: "project.write",
  PROJECT_DELETE: "project.delete",
  PROJECT_EXPORT: "project.export",
  ASSET_READ: "asset.read",
  ASSET_WRITE: "asset.write",
  ASSET_DELETE: "asset.delete",
  CONNECTION_READ: "connection.read",
  CONNECTION_MANAGE: "connection.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.freeze(
  Object.values(PERMISSIONS),
);

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "EDITOR"
  | "CREATOR"
  | "REVIEWER"
  | "VIEWER";

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = Object.freeze([
  "OWNER",
  "ADMIN",
  "EDITOR",
  "CREATOR",
  "REVIEWER",
  "VIEWER",
]);

const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.WORKSPACE_WRITE,
    PERMISSIONS.WORKSPACE_MANAGE_MEMBERS,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.PROJECT_DELETE,
    PERMISSIONS.PROJECT_EXPORT,
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.ASSET_WRITE,
    PERMISSIONS.ASSET_DELETE,
    PERMISSIONS.CONNECTION_READ,
    PERMISSIONS.CONNECTION_MANAGE,
  ],
  EDITOR: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.PROJECT_EXPORT,
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.ASSET_WRITE,
    PERMISSIONS.ASSET_DELETE,
    PERMISSIONS.CONNECTION_READ,
  ],
  CREATOR: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_WRITE,
    PERMISSIONS.PROJECT_EXPORT,
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.ASSET_WRITE,
    PERMISSIONS.CONNECTION_READ,
  ],
  REVIEWER: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_EXPORT,
    PERMISSIONS.ASSET_READ,
  ],
  VIEWER: [
    PERMISSIONS.WORKSPACE_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.PROJECT_EXPORT,
    PERMISSIONS.ASSET_READ,
  ],
};

export function permissionsForRole(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(
  role: WorkspaceRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === "string" &&
    (WORKSPACE_ROLES as readonly string[]).includes(value)
  );
}
