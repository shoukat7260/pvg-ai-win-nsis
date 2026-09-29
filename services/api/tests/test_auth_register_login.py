"""Register and login flows."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.services.email_service import get_console_outbox


@pytest.mark.asyncio
async def test_register_and_login(app_client: AsyncClient) -> None:
    email = f"newuser-{uuid.uuid4().hex[:10]}@example.com"
    password = "secure-password-1"
    reg = await app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "New User"},
    )
    assert reg.status_code == 201, reg.text
    body = reg.json()
    assert body["email"] == email
    assert body["status"] == "pending_verification"
    assert "password" not in body
    assert "password_hash" not in body

    bad = await app_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "wrong-password-xx"},
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["message"] == "Invalid email or password"

    ok = await app_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "device_fingerprint": "fp-1", "device_name": "Laptop"},
    )
    assert ok.status_code == 200, ok.text
    tokens = ok.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]
    assert tokens["mfa_required"] is False

    me = await app_client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


@pytest.mark.asyncio
async def test_login_generic_error_unknown_user(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/auth/login",
        json={"email": f"nosuch-{uuid.uuid4().hex[:10]}@example.com", "password": "whatever-password"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["message"] == "Invalid email or password"
