"""Ensure provider secrets never land in the cloud database."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker


SECRET = "TEST_PROVIDER_SECRET_ABC_123"


@pytest.mark.asyncio
async def test_provider_secret_not_persisted_in_postgres(
    app_client: AsyncClient,
    admin_engine: AsyncEngine,
) -> None:
    email = f"vault-meta-{uuid.uuid4().hex[:10]}@example.com"
    await app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secure-password-1", "display_name": "V"},
    )
    login = await app_client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": "secure-password-1",
            "device_fingerprint": f"fp-vault-{uuid.uuid4().hex[:8]}",
            "device_name": "PC",
        },
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Attempt to smuggle secret into connection create — must be rejected or stripped
    resp = await app_client.post(
        "/api/v1/connections",
        headers=headers,
        json={
            "provider_type": "elevenlabs",
            "display_name": "EL",
            "credential_ref": "vault:provider:elevenlabs",
            "api_key": SECRET,
        },
    )
    assert resp.status_code in (400, 422) or SECRET not in resp.text

    # Valid metadata-only create
    ok = await app_client.post(
        "/api/v1/connections",
        headers=headers,
        json={
            "provider_type": "elevenlabs",
            "display_name": "EL",
            "credential_ref": "vault:provider:elevenlabs",
        },
    )
    assert ok.status_code in (200, 201), ok.text
    assert SECRET not in ok.text

    factory = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        rows = (
            await session.execute(
                text(
                    "SELECT display_name, credential_ref, account_label::text "
                    "FROM provider_connections"
                )
            )
        ).fetchall()
        blob = " | ".join(" ".join(str(c) for c in r if c is not None) for r in rows)
        assert SECRET not in blob
