"""Phase 2 cross-account isolation for connections and billing."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


async def _auth(client: AsyncClient, email: str) -> dict:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secure-password-1", "display_name": "U"},
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
    assert login.status_code == 200, login.text
    return login.json()


@pytest.mark.asyncio
async def test_connection_metadata_isolated(app_client: AsyncClient) -> None:
    a = await _auth(app_client, f"conn-a-{uuid.uuid4().hex[:10]}@example.com")
    b = await _auth(app_client, f"conn-b-{uuid.uuid4().hex[:10]}@example.com")
    ah = {"Authorization": f"Bearer {a['access_token']}"}
    bh = {"Authorization": f"Bearer {b['access_token']}"}

    created = await app_client.post(
        "/api/v1/connections",
        headers=ah,
        json={
            "provider_type": "elevenlabs",
            "display_name": "A ElevenLabs",
            "credential_ref": "vault:provider:elevenlabs",
            "connection_method": "api_key",
        },
    )
    assert created.status_code in (200, 201), created.text
    conn_id = created.json()["id"]

    # B cannot list A's connection
    blist = await app_client.get("/api/v1/connections", headers=bh)
    assert blist.status_code == 200
    assert all(c["id"] != conn_id for c in blist.json()["items"])

    # B cannot delete A's connection
    bad = await app_client.delete(f"/api/v1/connections/{conn_id}", headers=bh)
    assert bad.status_code in (403, 404)


@pytest.mark.asyncio
async def test_reject_raw_api_key_in_connection_body(app_client: AsyncClient) -> None:
    a = await _auth(app_client, f"conn-secret-{uuid.uuid4().hex[:10]}@example.com")
    ah = {"Authorization": f"Bearer {a['access_token']}"}
    resp = await app_client.post(
        "/api/v1/connections",
        headers=ah,
        json={
            "provider_type": "elevenlabs",
            "display_name": "Bad",
            "api_key": "sk_live_SHOULD_NOT_BE_ACCEPTED",
            "secret": "also-bad",
        },
    )
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_billing_isolation(app_client: AsyncClient) -> None:
    a = await _auth(app_client, f"bill-a-{uuid.uuid4().hex[:10]}@example.com")
    b = await _auth(app_client, f"bill-b-{uuid.uuid4().hex[:10]}@example.com")
    ah = {"Authorization": f"Bearer {a['access_token']}"}
    bh = {"Authorization": f"Bearer {b['access_token']}"}

    a_sub = await app_client.get("/api/v1/billing/subscription", headers=ah)
    b_sub = await app_client.get("/api/v1/billing/subscription", headers=bh)
    assert a_sub.status_code == 200
    assert b_sub.status_code == 200
    # Each user gets their own subscription row
    if a_sub.json().get("id") and b_sub.json().get("id"):
        assert a_sub.json()["id"] != b_sub.json()["id"]

    a_inv = await app_client.get("/api/v1/billing/invoices", headers=ah)
    assert a_inv.status_code == 200
