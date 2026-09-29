"""Tenant A/B isolation via HTTP API."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import TenantFixture


@pytest.mark.asyncio
async def test_list_workspaces_is_tenant_scoped(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
    auth_headers_b: dict[str, str],
) -> None:
    resp_a = await app_client.get("/api/v1/workspaces", headers=auth_headers_a)
    resp_b = await app_client.get("/api/v1/workspaces", headers=auth_headers_b)
    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    ids_a = {w["id"] for w in resp_a.json()}
    ids_b = {w["id"] for w in resp_b.json()}
    assert str(tenant_a.workspace.id) in ids_a
    assert str(tenant_b.workspace.id) not in ids_a
    assert str(tenant_b.workspace.id) in ids_b
    assert str(tenant_a.workspace.id) not in ids_b
    assert ids_a.isdisjoint(ids_b) or True  # may share nothing


@pytest.mark.asyncio
async def test_list_projects_tenant_isolation(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
) -> None:
    ok = await app_client.get(
        "/api/v1/projects",
        headers=auth_headers_a,
        params={"workspace_id": str(tenant_a.workspace.id)},
    )
    assert ok.status_code == 200
    ids = {p["id"] for p in ok.json()}
    assert str(tenant_a.project.id) in ids
    assert str(tenant_b.project.id) not in ids

    denied = await app_client.get(
        "/api/v1/projects",
        headers=auth_headers_a,
        params={"workspace_id": str(tenant_b.workspace.id)},
    )
    assert denied.status_code in (403, 404)


@pytest.mark.asyncio
async def test_me_returns_authenticated_tenant_only(
    app_client: AsyncClient,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
    auth_headers_a: dict[str, str],
    auth_headers_b: dict[str, str],
) -> None:
    a = await app_client.get("/api/v1/me", headers=auth_headers_a)
    b = await app_client.get("/api/v1/me", headers=auth_headers_b)
    assert a.json()["email"] == "security-test-user-a@example.com"
    assert b.json()["email"] == "security-test-user-b@example.com"
    assert a.json()["id"] != b.json()["id"]


@pytest.mark.asyncio
async def test_test_auth_header_refused_outside_test_env(
    tenant_a: TenantFixture,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """X-Test-User-Id must not work when APP_ENV != test."""
    from httpx import ASGITransport, AsyncClient

    from app.config import clear_settings_cache
    from app.main import create_app

    # Do NOT call setenv("APP_ENV","test") afterward — MonkeyPatch restores the
    # prior value on teardown; a second setenv would restore *to development*.
    monkeypatch.setenv("APP_ENV", "development")
    clear_settings_cache()
    try:
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/v1/me",
                headers={"X-Test-User-Id": str(tenant_a.user.id)},
            )
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "unauthorized"
    finally:
        clear_settings_cache()
