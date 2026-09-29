"""Hashed single-use email verification and password-reset tokens."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.auth.tokens import hash_token


@dataclass(frozen=True)
class IssuedToken:
    raw: str
    token_hash: str
    expires_at: datetime


def issue_email_token(*, ttl_seconds: int) -> IssuedToken:
    raw = secrets.token_urlsafe(32)
    return IssuedToken(
        raw=raw,
        token_hash=hash_token(raw),
        expires_at=datetime.now(UTC) + timedelta(seconds=ttl_seconds),
    )


def issue_password_reset_token(*, ttl_seconds: int) -> IssuedToken:
    return issue_email_token(ttl_seconds=ttl_seconds)


def hash_raw_token(raw: str) -> str:
    return hash_token(raw)
