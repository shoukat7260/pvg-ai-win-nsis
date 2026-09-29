"""Configuration fail-closed tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings, clear_settings_cache


def test_development_allows_empty_jwt() -> None:
    clear_settings_cache()
    settings = Settings(APP_ENV="development", JWT_SECRET="")
    assert settings.app_env == "development"
    assert not settings.allow_test_auth_header


def test_test_env_allows_test_header() -> None:
    settings = Settings(APP_ENV="test", JWT_SECRET="")
    assert settings.allow_test_auth_header is True


def test_production_requires_strong_jwt() -> None:
    with pytest.raises(ValidationError):
        Settings(
            APP_ENV="production",
            JWT_SECRET="short",
            DATABASE_URL="postgresql+asyncpg://app:securepass@db:5432/pvg",
            DATABASE_ADMIN_URL="postgresql+asyncpg://migrator:securepass@db:5432/pvg",
        )


def test_production_rejects_change_me_db_credentials() -> None:
    with pytest.raises(ValidationError):
        Settings(
            APP_ENV="production",
            JWT_SECRET="x" * 32,
            JWT_ISSUER="pvg-ai",
            JWT_AUDIENCE="pvg-api",
            CSRF_SECRET="c" * 32,
            MFA_ENCRYPTION_KEY="m" * 32,
            PAYMENT_WEBHOOK_SECRET="w" * 32,
            DATABASE_URL="postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5432/pvg",
            DATABASE_ADMIN_URL="postgresql+asyncpg://pvg_migrator:ok@localhost:5432/pvg",
        )


def test_staging_fail_closed() -> None:
    with pytest.raises(ValidationError):
        Settings(APP_ENV="staging", JWT_SECRET="")


def test_production_ok_with_strong_secrets() -> None:
    settings = Settings(
        APP_ENV="production",
        JWT_SECRET="a" * 40,
        JWT_ISSUER="pvg-ai",
        JWT_AUDIENCE="pvg-api",
        CSRF_SECRET="c" * 32,
        MFA_ENCRYPTION_KEY="m" * 32,
        PAYMENT_WEBHOOK_SECRET="w" * 32,
        DATABASE_URL="postgresql+asyncpg://app:secure_prod_pw@db:5432/pvg",
        DATABASE_ADMIN_URL="postgresql+asyncpg://migrator:secure_prod_pw@db:5432/pvg",
        CORS_ORIGINS="https://app.example.com",
    )
    assert settings.is_production_like
    assert settings.allow_test_auth_header is False


def test_production_requires_issuer_audience() -> None:
    with pytest.raises(ValidationError):
        Settings(
            APP_ENV="production",
            JWT_SECRET="a" * 40,
            JWT_ISSUER="",
            JWT_AUDIENCE="",
            CSRF_SECRET="c" * 32,
            MFA_ENCRYPTION_KEY="m" * 32,
            PAYMENT_WEBHOOK_SECRET="w" * 32,
            DATABASE_URL="postgresql+asyncpg://app:secure_prod_pw@db:5432/pvg",
            DATABASE_ADMIN_URL="postgresql+asyncpg://migrator:secure_prod_pw@db:5432/pvg",
            CORS_ORIGINS="https://app.example.com",
        )


def test_production_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError):
        Settings(
            APP_ENV="production",
            JWT_SECRET="a" * 40,
            JWT_ISSUER="pvg-ai",
            JWT_AUDIENCE="pvg-api",
            CSRF_SECRET="c" * 32,
            MFA_ENCRYPTION_KEY="m" * 32,
            PAYMENT_WEBHOOK_SECRET="w" * 32,
            DATABASE_URL="postgresql+asyncpg://app:secure_prod_pw@db:5432/pvg",
            DATABASE_ADMIN_URL="postgresql+asyncpg://migrator:secure_prod_pw@db:5432/pvg",
            CORS_ORIGINS="*",
        )
