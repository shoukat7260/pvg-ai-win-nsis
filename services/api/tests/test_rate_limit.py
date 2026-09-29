"""Rate limiting tests."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import clear_settings_cache
from app.main import create_app
from app.services.rate_limit import RateLimiter, get_rate_limiter


def test_rate_limiter_allows_under_limit() -> None:
    limiter = RateLimiter()
    for _ in range(5):
        result = limiter.check(key="k", limit=5, window_seconds=60)
        assert result.allowed


def test_rate_limiter_blocks_over_limit() -> None:
    limiter = RateLimiter()
    for _ in range(3):
        limiter.check(key="k", limit=3, window_seconds=60)
    blocked = limiter.check(key="k", limit=3, window_seconds=60)
    assert blocked.allowed is False
    assert blocked.remaining == 0


@pytest.mark.asyncio
async def test_rate_limit_middleware_returns_429(monkeypatch: pytest.MonkeyPatch) -> None:
    # Only set the knobs we need; MonkeyPatch restores prior env on teardown.
    # Do not setenv a "restore" value — that would undo to the limited value.
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("RATE_LIMIT_DEFAULT_PER_MINUTE", "3")
    clear_settings_cache()
    get_rate_limiter().reset()

    try:
        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            codes = []
            for _ in range(5):
                resp = await client.get("/health")
                codes.append(resp.status_code)
        assert 429 in codes
        assert codes.count(200) >= 1
    finally:
        clear_settings_cache()
        get_rate_limiter().reset()
