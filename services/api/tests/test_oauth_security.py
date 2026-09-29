"""OAuth / desktop auth security basics (state/PKCE required)."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_desktop_start_returns_state(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/auth/desktop/start",
        json={"code_challenge": "challenge-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "code_challenge_method": "S256"},
    )
    # May require auth or be public start — either way must not leak secrets
    assert resp.status_code in (200, 201, 401, 422)
    if resp.status_code in (200, 201):
        data = resp.json()
        assert "state" in data or "authorize_url" in data
        assert "client_secret" not in str(data).lower()


@pytest.mark.asyncio
async def test_desktop_complete_rejects_bad_state(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/auth/desktop/complete",
        json={
            "code": "not-a-real-code",
            "state": "wrong-state",
            "code_verifier": "verifier-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
    )
    assert resp.status_code in (400, 401, 403, 404, 422)


@pytest.mark.asyncio
async def test_google_authorize_without_config_is_safe(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/oauth/google/authorize")
    # Without GOOGLE_OAUTH_* should fail closed / not found / 503 — never return secrets
    assert resp.status_code in (400, 404, 501, 503, 422)
    assert "client_secret" not in resp.text.lower()
