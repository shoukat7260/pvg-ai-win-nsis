"""Role → permission matrix. Deny by default."""

from __future__ import annotations

from enum import StrEnum

from app.models.enums import WorkspaceRole


class Permission(StrEnum):
    WORKSPACE_READ = "workspace.read"
    WORKSPACE_WRITE = "workspace.write"
    WORKSPACE_MANAGE_MEMBERS = "workspace.manage_members"
    PROJECT_READ = "project.read"
    PROJECT_WRITE = "project.write"
    PROJECT_DELETE = "project.delete"
    PROJECT_EXPORT = "project.export"
    ASSET_READ = "asset.read"
    ASSET_WRITE = "asset.write"
    ASSET_DELETE = "asset.delete"
    CONNECTION_READ = "connection.read"
    CONNECTION_MANAGE = "connection.manage"
    GENERATION_READ = "generation.read"
    GENERATION_WRITE = "generation.write"


ROLE_PERMISSIONS: dict[WorkspaceRole, frozenset[Permission]] = {
    WorkspaceRole.OWNER: frozenset(Permission),
    WorkspaceRole.ADMIN: frozenset(
        {
            Permission.WORKSPACE_READ,
            Permission.WORKSPACE_WRITE,
            Permission.WORKSPACE_MANAGE_MEMBERS,
            Permission.PROJECT_READ,
            Permission.PROJECT_WRITE,
            Permission.PROJECT_DELETE,
            Permission.PROJECT_EXPORT,
            Permission.ASSET_READ,
            Permission.ASSET_WRITE,
            Permission.ASSET_DELETE,
            Permission.CONNECTION_READ,
            Permission.CONNECTION_MANAGE,
            Permission.GENERATION_READ,
            Permission.GENERATION_WRITE,
        }
    ),
    WorkspaceRole.EDITOR: frozenset(
        {
            Permission.WORKSPACE_READ,
            Permission.PROJECT_READ,
            Permission.PROJECT_WRITE,
            Permission.PROJECT_EXPORT,
            Permission.ASSET_READ,
            Permission.ASSET_WRITE,
            Permission.ASSET_DELETE,
            Permission.CONNECTION_READ,
            Permission.GENERATION_READ,
            Permission.GENERATION_WRITE,
        }
    ),
    WorkspaceRole.CREATOR: frozenset(
        {
            Permission.WORKSPACE_READ,
            Permission.PROJECT_READ,
            Permission.PROJECT_WRITE,
            Permission.PROJECT_EXPORT,
            Permission.ASSET_READ,
            Permission.ASSET_WRITE,
            Permission.GENERATION_READ,
            Permission.GENERATION_WRITE,
        }
    ),
    WorkspaceRole.REVIEWER: frozenset(
        {
            Permission.WORKSPACE_READ,
            Permission.PROJECT_READ,
            Permission.PROJECT_EXPORT,
            Permission.ASSET_READ,
            Permission.GENERATION_READ,
        }
    ),
    WorkspaceRole.VIEWER: frozenset(
        {
            Permission.WORKSPACE_READ,
            Permission.PROJECT_READ,
            Permission.PROJECT_EXPORT,
            Permission.ASSET_READ,
            Permission.GENERATION_READ,
        }
    ),
}


def role_has_permission(role: WorkspaceRole, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def permissions_for_role(role: WorkspaceRole) -> frozenset[Permission]:
    return ROLE_PERMISSIONS.get(role, frozenset())
