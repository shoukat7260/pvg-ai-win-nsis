"""Ownership enforcement — client-provided owner IDs are ignored."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import TenantFixture


@pytest.mark.asyncio
async def test_create_workspace_ignores_client_owner_id(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    resp = await app_client.post(
        "/api/v1/workspaces",
        headers=auth_headers_a,
        json={
            "name": "Owned by A",
            "type": "personal",
            "owner_id": str(tenant_b.user.id),  # must be ignored
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["owner_id"] == str(tenant_a.user.id)
    assert body["owner_id"] != str(tenant_b.user.id)


@pytest.mark.asyncio
async def test_create_project_ignores_client_created_by(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    resp = await app_client.post(
        "/api/v1/projects",
        headers=auth_headers_a,
        json={
            "name": "Project owned by auth user",
            "workspace_id": str(tenant_a.workspace.id),
            "created_by": str(tenant_b.user.id),
            "owner_id": str(tenant_b.user.id),
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["created_by"] == str(tenant_a.user.id)
    assert body["workspace_id"] == str(tenant_a.workspace.id)


@pytest.mark.asyncio
async def test_user_can_crud_own_workspace(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    get_resp = await app_client.get(
        f"/api/v1/workspaces/{tenant_a.workspace.id}",
        headers=auth_headers_a,
    )
    assert get_resp.status_code == 200

    patch_resp = await app_client.patch(
        f"/api/v1/workspaces/{tenant_a.workspace.id}",
        headers=auth_headers_a,
        json={"name": "workspace_a_renamed"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "workspace_a_renamed"


@pytest.mark.asyncio
async def test_user_can_crud_own_project(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    get_resp = await app_client.get(
        f"/api/v1/projects/{tenant_a.project.id}",
        headers=auth_headers_a,
    )
    assert get_resp.status_code == 200

    patch_resp = await app_client.patch(
        f"/api/v1/projects/{tenant_a.project.id}",
        headers=auth_headers_a,
        json={"name": "project_a_renamed"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "project_a_renamed"
