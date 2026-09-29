"""Application configuration with fail-closed production defaults."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

AppEnv = Literal["development", "test", "staging", "production"]
EmailTransport = Literal["console", "smtp"]
PaymentProviderName = Literal["sandbox", "none"]


class Settings(BaseSettings):
    """Typed settings loaded from environment. Production fails closed."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: AppEnv = Field(default="development", alias="APP_ENV")
    app_name: str = Field(default="PVG AI", alias="APP_NAME")
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_public_url: str = Field(default="http://localhost:8000", alias="API_PUBLIC_URL")
    cors_origins: str = Field(
        default="http://localhost:1420,http://localhost:5173",
        alias="CORS_ORIGINS",
    )
    web_origin: str = Field(default="http://localhost:5173", alias="WEB_ORIGIN")

    database_url: str = Field(
        default="postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5444/pvg",
        alias="DATABASE_URL",
    )
    database_admin_url: str = Field(
        default=(
            "postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5444/pvg"
        ),
        alias="DATABASE_ADMIN_URL",
    )

    redis_url: str = Field(default="redis://localhost:6480/0", alias="REDIS_URL")

    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_issuer: str = Field(default="pvg-ai", alias="JWT_ISSUER")
    jwt_audience: str = Field(default="pvg-api", alias="JWT_AUDIENCE")
    access_token_ttl_seconds: int = Field(default=900, alias="ACCESS_TOKEN_TTL_SECONDS")
    refresh_token_ttl_seconds: int = Field(default=2_592_000, alias="REFRESH_TOKEN_TTL_SECONDS")

    csrf_secret: str = Field(default="", alias="CSRF_SECRET")
    mfa_encryption_key: str = Field(default="", alias="MFA_ENCRYPTION_KEY")

    email_transport: EmailTransport = Field(default="console", alias="EMAIL_TRANSPORT")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_username: str = Field(default="", alias="SMTP_USERNAME")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="noreply@pvg.ai", alias="SMTP_FROM")
    smtp_use_tls: bool = Field(default=True, alias="SMTP_USE_TLS")

    google_oauth_client_id: str = Field(default="", alias="GOOGLE_OAUTH_CLIENT_ID")
    google_oauth_client_secret: str = Field(default="", alias="GOOGLE_OAUTH_CLIENT_SECRET")
    google_oauth_redirect_uri: str = Field(default="", alias="GOOGLE_OAUTH_REDIRECT_URI")

    payment_provider: PaymentProviderName = Field(default="sandbox", alias="PAYMENT_PROVIDER")
    payment_webhook_secret: str = Field(default="", alias="PAYMENT_WEBHOOK_SECRET")

    desktop_auth_redirect: str = Field(
        default="pvg://auth/callback",
        alias="DESKTOP_AUTH_REDIRECT",
    )

    credential_vault_master_key: str = Field(default="", alias="CREDENTIAL_VAULT_MASTER_KEY")

    rate_limit_default_per_minute: int = Field(default=60, alias="RATE_LIMIT_DEFAULT_PER_MINUTE")
    rate_limit_auth_per_minute: int = Field(default=20, alias="RATE_LIMIT_AUTH_PER_MINUTE")
    rate_limit_auth_account_per_minute: int = Field(
        default=10, alias="RATE_LIMIT_AUTH_ACCOUNT_PER_MINUTE"
    )

    feature_flags: str = Field(default="{}", alias="FEATURE_FLAGS")

    email_verification_ttl_seconds: int = Field(
        default=86_400, alias="EMAIL_VERIFICATION_TTL_SECONDS"
    )
    password_reset_ttl_seconds: int = Field(default=3_600, alias="PASSWORD_RESET_TTL_SECONDS")
    desktop_auth_code_ttl_seconds: int = Field(
        default=600, alias="DESKTOP_AUTH_CODE_TTL_SECONDS"
    )
    auth_challenge_ttl_seconds: int = Field(default=300, alias="AUTH_CHALLENGE_TTL_SECONDS")

    @field_validator("app_env", mode="before")
    @classmethod
    def normalize_env(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("email_transport", "payment_provider", mode="before")
    @classmethod
    def normalize_literal(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @model_validator(mode="after")
    def fail_closed_in_production(self) -> Settings:
        """Refuse insecure defaults when running in staging or production."""
        if self.app_env in ("staging", "production"):
            if not self.jwt_secret or len(self.jwt_secret) < 32:
                raise ValueError(
                    "JWT_SECRET must be set to a strong value (>=32 chars) "
                    f"when APP_ENV={self.app_env}"
                )
            if not self.jwt_issuer or not self.jwt_audience:
                raise ValueError(
                    "JWT_ISSUER and JWT_AUDIENCE are required "
                    f"when APP_ENV={self.app_env}"
                )
            if "change_me" in self.database_url or "change_me" in self.database_admin_url:
                raise ValueError(
                    "Default development database credentials are forbidden "
                    f"when APP_ENV={self.app_env}"
                )
            if self.email_transport == "smtp":
                if not self.smtp_host or not self.smtp_from:
                    raise ValueError(
                        "SMTP_HOST and SMTP_FROM are required when EMAIL_TRANSPORT=smtp "
                        f"and APP_ENV={self.app_env}"
                    )
            if self.payment_provider != "none":
                if not self.payment_webhook_secret or len(self.payment_webhook_secret) < 32:
                    raise ValueError(
                        "PAYMENT_WEBHOOK_SECRET (>=32 chars) is required when payments "
                        f"are enabled and APP_ENV={self.app_env}"
                    )
            if not self.mfa_encryption_key:
                raise ValueError(
                    f"MFA_ENCRYPTION_KEY is required when APP_ENV={self.app_env}"
                )
            if not self.csrf_secret or len(self.csrf_secret) < 32:
                raise ValueError(
                    f"CSRF_SECRET (>=32 chars) is required when APP_ENV={self.app_env}"
                )
            if self.app_env == "production" and "*" in self.cors_origins:
                raise ValueError("Wildcard CORS is forbidden in production")
            if "*" in self.cors_origins:
                raise ValueError(
                    "Wildcard CORS with credentials is forbidden "
                    f"when APP_ENV={self.app_env}"
                )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"

    @property
    def is_production_like(self) -> bool:
        return self.app_env in ("staging", "production")

    @property
    def allow_test_auth_header(self) -> bool:
        """X-Test-User-Id is permitted ONLY when APP_ENV=test."""
        return self.app_env == "test"

    @property
    def effective_csrf_secret(self) -> str:
        return self.csrf_secret or self.jwt_secret or "dev-csrf-secret-not-for-production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
