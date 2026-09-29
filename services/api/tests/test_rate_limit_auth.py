"""Auth rate limiting (IP + account)."""

from __future__ import annotations

import pytest

from app.auth.rate_limits import check_auth_rate_limits
from app.config import Settings
from app.errors import RateLimitError
from app.services.rate_limit import RateLimiter


def test_layered_auth_rate_limit() -> None:
    limiter = RateLimiter()
    settings = Settings(
        APP_ENV="test",
        RATE_LIMIT_AUTH_PER_MINUTE=3,
        RATE_LIMIT_AUTH_ACCOUNT_PER_MINUTE=2,
        JWT_SECRET="x" * 32,
    )
    check_auth_rate_limits(
        settings=settings, ip_address="1.2.3.4", account_key="a@b.com", limiter=limiter
    )
    check_auth_rate_limits(
        settings=settings, ip_address="1.2.3.4", account_key="a@b.com", limiter=limiter
    )
    with pytest.raises(RateLimitError):
        check_auth_rate_limits(
            settings=settings, ip_address="1.2.3.4", account_key="a@b.com", limiter=limiter
        )
