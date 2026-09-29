"""IDOR suite — 12 cases. User A must never access User B resources by ID."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import TenantFixture


@pytest.mark.asyncio
async def test_idor_01_get_foreign_workspace(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 1: GET another tenant's workspace by ID."""
    resp = await app_client.get(
        f"/api/v1/workspaces/{tenant_b.workspace.id}",
        headers=auth_headers_a,
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_02_update_foreign_workspace(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 2: PATCH another tenant's workspace."""
    resp = await app_client.patch(
        f"/api/v1/workspaces/{tenant_b.workspace.id}",
        headers=auth_headers_a,
        json={"name": "hacked"},
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_03_delete_foreign_workspace(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 3: DELETE another tenant's workspace."""
    resp = await app_client.delete(
        f"/api/v1/workspaces/{tenant_b.workspace.id}",
        headers=auth_headers_a,
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_04_get_foreign_project(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 4: GET another tenant's project by ID."""
    resp = await app_client.get(
        f"/api/v1/projects/{tenant_b.project.id}",
        headers=auth_headers_a,
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_05_update_foreign_project(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 5: PATCH another tenant's project."""
    resp = await app_client.patch(
        f"/api/v1/projects/{tenant_b.project.id}",
        headers=auth_headers_a,
        json={"name": "hacked-project"},
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_06_delete_foreign_project(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 6: DELETE another tenant's project."""
    resp = await app_client.delete(
        f"/api/v1/projects/{tenant_b.project.id}",
        headers=auth_headers_a,
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_07_create_project_in_foreign_workspace(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 7: Create a project inside another tenant's workspace."""
    resp = await app_client.post(
        "/api/v1/projects",
        headers=auth_headers_a,
        json={"name": "intrusion", "workspace_id": str(tenant_b.workspace.id)},
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_08_list_projects_in_foreign_workspace(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 8: List projects for another tenant's workspace."""
    resp = await app_client.get(
        "/api/v1/projects",
        headers=auth_headers_a,
        params={"workspace_id": str(tenant_b.workspace.id)},
    )
    assert resp.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_09_spoof_owner_id_on_create_does_not_grant_access(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 9: Claiming B's owner_id still creates under A; B's resources stay forbidden."""
    create = await app_client.post(
        "/api/v1/workspaces",
        headers=auth_headers_a,
        json={"name": "spoof", "owner_id": str(tenant_b.user.id)},
    )
    assert create.status_code == 201
    assert create.json()["owner_id"] == str(tenant_a.user.id)

    # Still cannot read B
    forbidden = await app_client.get(
        f"/api/v1/workspaces/{tenant_b.workspace.id}",
        headers=auth_headers_a,
    )
    assert forbidden.status_code in (403, 404)


@pytest.mark.asyncio
async def test_idor_10_body_user_id_ignored_for_authz(
    app_client: AsyncClient,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 10: Extra body user_id / workspace owner claims do not authorize foreign access."""
    resp = await app_client.patch(
        f"/api/v1/workspaces/{tenant_b.workspace.id}",
        headers=auth_headers_a,
        json={"name": "nope", "owner_id": str(tenant_b.user.id), "user_id": str(tenant_b.user.id)},
    )
    # Either validation strips unknown fields or authz denies — never success
    assert resp.status_code != 200


@pytest.mark.asyncio
async def test_idor_11_random_uuid_resource_not_found(
    app_client: AsyncClient,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 11: Unknown UUIDs return not found (no leak / no crash)."""
    random_id = uuid.uuid4()
    resp = await app_client.get(f"/api/v1/projects/{random_id}", headers=auth_headers_a)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


@pytest.mark.asyncio
async def test_idor_12_cross_tenant_me_cannot_impersonate(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    """Case 12: Authenticated as A, /me is always A — never B via query/body tricks."""
    resp = await app_client.get(
        "/api/v1/me",
        headers=auth_headers_a,
        params={"user_id": str(tenant_b.user.id)},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == str(tenant_a.user.id)
    assert resp.json()["id"] != str(tenant_b.user.id)
