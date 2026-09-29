"""Devices and sessions isolation / revocation."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _register_login(
    client: AsyncClient, email: str, password: str = "secure-password-1", *, fp: str
) -> dict:
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": email.split("@")[0]},
    )
    assert reg.status_code == 201, reg.text
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
            "device_fingerprint": fp,
            "device_name": f"Device-{fp}",
            "platform": "linux",
            "app_version": "0.2.0",
        },
    )
    assert login.status_code == 200, login.text
    return login.json()


@pytest.mark.asyncio
async def test_list_devices_after_login(app_client: AsyncClient) -> None:
    tokens = await _register_login(app_client, f"device-a-{uuid.uuid4().hex[:10]}@example.com", fp=f"fp-device-a-{uuid.uuid4().hex[:8]}")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    resp = await app_client.get("/api/v1/devices", headers=headers)
    assert resp.status_code == 200, resp.text
    items = resp.json()["items"]
    assert len(items) >= 1
    assert items[0]["name"]


@pytest.mark.asyncio
async def test_revoke_device_blocks_refresh(app_client: AsyncClient) -> None:
    tokens = await _register_login(app_client, f"device-revoke-{uuid.uuid4().hex[:10]}@example.com", fp=f"fp-revoke-{uuid.uuid4().hex[:8]}")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    devices = (await app_client.get("/api/v1/devices", headers=headers)).json()["items"]
    device_id = devices[0]["id"]

    revoked = await app_client.post(f"/api/v1/devices/{device_id}/revoke", headers=headers)
    assert revoked.status_code == 200, revoked.text

    refresh = await app_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh.status_code in (401, 403)


@pytest.mark.asyncio
async def test_user_cannot_list_other_user_devices(app_client: AsyncClient) -> None:
    a = await _register_login(app_client, f"iso-dev-a-{uuid.uuid4().hex[:10]}@example.com", fp=f"fp-iso-a-{uuid.uuid4().hex[:8]}")
    b = await _register_login(app_client, f"iso-dev-b-{uuid.uuid4().hex[:10]}@example.com", fp=f"fp-iso-b-{uuid.uuid4().hex[:8]}")
    a_headers = {"Authorization": f"Bearer {a['access_token']}"}
    b_headers = {"Authorization": f"Bearer {b['access_token']}"}

    a_devices = (await app_client.get("/api/v1/devices", headers=a_headers)).json()["items"]
    b_list = await app_client.get("/api/v1/devices", headers=b_headers)
    b_ids = {d["id"] for d in b_list.json()["items"]}
    for d in a_devices:
        assert d["id"] not in b_ids

    # Attempt revoke of A's device as B
    if a_devices:
        bad = await app_client.post(
            f"/api/v1/devices/{a_devices[0]['id']}/revoke",
            headers=b_headers,
        )
        assert bad.status_code in (403, 404)


@pytest.mark.asyncio
async def test_sessions_list_and_revoke_others(app_client: AsyncClient) -> None:
    email = f"sess-user-{uuid.uuid4().hex[:10]}@example.com"
    tokens = await _register_login(app_client, email, fp=f"fp-sess-1-{uuid.uuid4().hex[:8]}")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    # Second login = second session
    second = await app_client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": "secure-password-1",
            "device_fingerprint": f"fp-sess-2-{uuid.uuid4().hex[:8]}",
            "device_name": "Other",
        },
    )
    assert second.status_code == 200, second.text
    sessions = await app_client.get("/api/v1/sessions", headers=headers)
    assert sessions.status_code == 200
    assert len(sessions.json()["items"]) >= 1

    revoke_others = await app_client.post("/api/v1/sessions/revoke-others", headers=headers)
    assert revoke_others.status_code == 200, revoke_others.text

    # Second refresh should fail
    refresh = await app_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": second.json()["refresh_token"]},
    )
    assert refresh.status_code in (401, 403)
