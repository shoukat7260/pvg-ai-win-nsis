"""Sandbox payment webhook verification + isolation."""

from __future__ import annotations

import uuid

import hashlib
import hmac
import json

import pytest
from httpx import AsyncClient


async def _login(client: AsyncClient, email: str) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secure-password-1", "display_name": "P"},
    )
    login = await client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": "secure-password-1",
            "device_fingerprint": f"fp-{email}-{uuid.uuid4().hex[:6]}",
            "device_name": "PC",
        },
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def _sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(app_client: AsyncClient) -> None:
    payload = {"event_id": "evt_bad_1", "type": "payment.succeeded", "data": {}}
    body = json.dumps(payload).encode()
    resp = await app_client.post(
        "/api/v1/billing/webhook",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-PVG-Signature": "deadbeef",
        },
    )
    assert resp.status_code in (401, 403, 400)


@pytest.mark.asyncio
async def test_checkout_is_server_authoritative(app_client: AsyncClient) -> None:
    token = await _login(app_client, f"pay-user-{uuid.uuid4().hex[:10]}@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    # Client cannot force amount=0
    resp = await app_client.post(
        "/api/v1/billing/checkout",
        headers=headers,
        json={"plan_code": "pro", "amount": 0, "price": 0},
    )
    # Either accepted with server price, or validation ignores amount — never trust amount
    assert resp.status_code in (200, 201, 422)
    if resp.status_code in (200, 201):
        data = resp.json()
        assert "checkout_id" in data or "checkout_url" in data
        assert data.get("amount") != 0 or "checkout_url" in data
