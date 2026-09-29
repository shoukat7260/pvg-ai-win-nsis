"""Health endpoint tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import clear_settings_cache
from app.main import create_app


@pytest.mark.asyncio
async def test_health_ok() -> None:
    clear_settings_cache()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "X-Request-ID" in resp.headers


@pytest.mark.asyncio
async def test_health_structured_error_shape_on_unauth_me() -> None:
    clear_settings_cache()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/me")
    assert resp.status_code == 401
    body = resp.json()
    assert "error" in body
    assert body["error"]["code"] == "unauthorized"
    assert "request_id" in body["error"]
