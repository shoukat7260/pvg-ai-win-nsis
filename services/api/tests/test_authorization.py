"""Authorization permission matrix and deny-by-default tests."""

from __future__ import annotations

import pytest

from app.models.enums import WorkspaceRole
from app.security.permissions import Permission, permissions_for_role, role_has_permission


@pytest.mark.parametrize(
    ("role", "permission", "expected"),
    [
        (WorkspaceRole.OWNER, Permission.WORKSPACE_WRITE, True),
        (WorkspaceRole.ADMIN, Permission.WORKSPACE_MANAGE_MEMBERS, True),
        (WorkspaceRole.EDITOR, Permission.PROJECT_WRITE, True),
        (WorkspaceRole.EDITOR, Permission.WORKSPACE_WRITE, False),
        (WorkspaceRole.CREATOR, Permission.ASSET_WRITE, True),
        (WorkspaceRole.CREATOR, Permission.ASSET_DELETE, False),
        (WorkspaceRole.REVIEWER, Permission.PROJECT_READ, True),
        (WorkspaceRole.REVIEWER, Permission.PROJECT_WRITE, False),
        (WorkspaceRole.VIEWER, Permission.PROJECT_READ, True),
        (WorkspaceRole.VIEWER, Permission.CONNECTION_MANAGE, False),
        (WorkspaceRole.VIEWER, Permission.PROJECT_DELETE, False),
        (WorkspaceRole.ADMIN, Permission.PROJECT_DELETE, True),
    ],
)
def test_permission_matrix(role: WorkspaceRole, permission: Permission, expected: bool) -> None:
    assert role_has_permission(role, permission) is expected


def test_owner_has_all_permissions() -> None:
    assert permissions_for_role(WorkspaceRole.OWNER) == frozenset(Permission)


def test_unknown_role_denies() -> None:
    # Deny by default — empty frozenset for unknown
    assert role_has_permission(WorkspaceRole.VIEWER, Permission.CONNECTION_MANAGE) is False
