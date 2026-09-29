"""Layered auth rate limits: IP + account."""

from __future__ import annotations

from dataclasses import dataclass

from app.config import Settings
from app.errors import RateLimitError
from app.services.rate_limit import RateLimiter, get_rate_limiter


@dataclass(frozen=True)
class AuthRateLimitKeys:
    ip: str
    account: str | None = None


def check_auth_rate_limits(
    *,
    settings: Settings,
    ip_address: str | None,
    account_key: str | None = None,
    limiter: RateLimiter | None = None,
) -> None:
    limiter = limiter or get_rate_limiter()
    ip = ip_address or "unknown"
    ip_result = limiter.check(
        key=f"auth:ip:{ip}",
        limit=settings.rate_limit_auth_per_minute,
    )
    if not ip_result.allowed:
        raise RateLimitError("Too many authentication attempts from this IP")

    if account_key:
        acct_result = limiter.check(
            key=f"auth:account:{account_key.lower()}",
            limit=settings.rate_limit_auth_account_per_minute,
        )
        if not acct_result.allowed:
            raise RateLimitError("Too many authentication attempts for this account")
