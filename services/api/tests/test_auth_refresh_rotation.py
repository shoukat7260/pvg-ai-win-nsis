"""Refresh rotation and reuse detection."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _register_login(client: AsyncClient, email: str) -> dict:
    password = "secure-password-1"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "Rot"},
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()


@pytest.mark.asyncio
async def test_refresh_rotates_token(app_client: AsyncClient) -> None:
    tokens = await _register_login(app_client, f"rotate-{uuid.uuid4().hex[:10]}@example.com")
    first_refresh = tokens["refresh_token"]
    refreshed = await app_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh},
    )
    assert refreshed.status_code == 200, refreshed.text
    new_tokens = refreshed.json()
    assert new_tokens["refresh_token"] != first_refresh
    assert new_tokens["access_token"]


@pytest.mark.asyncio
async def test_refresh_reuse_detected(app_client: AsyncClient) -> None:
    tokens = await _register_login(app_client, f"reuse-{uuid.uuid4().hex[:10]}@example.com")
    first_refresh = tokens["refresh_token"]
    ok = await app_client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert ok.status_code == 200
    reuse = await app_client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert reuse.status_code == 401
    # New token from rotation should also be invalidated (family)
    second = ok.json()["refresh_token"]
    again = await app_client.post("/api/v1/auth/refresh", json={"refresh_token": second})
    assert again.status_code == 401
