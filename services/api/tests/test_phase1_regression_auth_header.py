"""Phase 1 regression: X-Test-User-Id only when APP_ENV=test."""

from __future__ import annotations

import pytest

from app.config import Settings, clear_settings_cache


@pytest.mark.asyncio
async def test_test_header_works_in_test_env(app_client, auth_headers_a, tenant_a) -> None:
    resp = await app_client.get("/api/v1/me", headers=auth_headers_a)
    assert resp.status_code == 200
    assert resp.json()["id"] == str(tenant_a.user.id)


def test_test_header_refused_outside_test() -> None:
    """Regression: development/production must not accept X-Test-User-Id."""
    clear_settings_cache()
    for env in ("development", "production"):
        kwargs: dict = {"APP_ENV": env, "JWT_SECRET": "x" * 32}
        if env == "production":
            kwargs.update(
                {
                    "JWT_ISSUER": "pvg-ai",
                    "JWT_AUDIENCE": "pvg-api",
                    "CSRF_SECRET": "c" * 32,
                    "MFA_ENCRYPTION_KEY": "m" * 32,
                    "PAYMENT_WEBHOOK_SECRET": "w" * 32,
                    "DATABASE_URL": "postgresql+asyncpg://app:secure_prod_pw@db:5432/pvg",
                    "DATABASE_ADMIN_URL": "postgresql+asyncpg://migrator:secure_prod_pw@db:5432/pvg",
                    "CORS_ORIGINS": "https://app.example.com",
                }
            )
        settings = Settings(**kwargs)
        assert settings.allow_test_auth_header is False
    clear_settings_cache()
