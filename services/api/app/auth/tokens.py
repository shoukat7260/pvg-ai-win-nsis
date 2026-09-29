"""JWT access tokens and opaque refresh tokens."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.config import Settings


ACCESS_TYP = "access"


@dataclass(frozen=True)
class AccessTokenClaims:
    sub: str
    sid: str
    jti: str
    iat: int
    exp: int
    iss: str
    aud: str
    typ: str = ACCESS_TYP


def generate_opaque_token(*, nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_access_token(
    *,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    settings: Settings,
    jti: str | None = None,
) -> tuple[str, AccessTokenClaims]:
    now = datetime.now(UTC)
    expires = now + timedelta(seconds=settings.access_token_ttl_seconds)
    token_jti = jti or secrets.token_urlsafe(16)
    claims = AccessTokenClaims(
        sub=str(user_id),
        sid=str(session_id),
        jti=token_jti,
        iat=int(now.timestamp()),
        exp=int(expires.timestamp()),
        iss=settings.jwt_issuer,
        aud=settings.jwt_audience,
        typ=ACCESS_TYP,
    )
    payload: dict[str, Any] = {
        "sub": claims.sub,
        "sid": claims.sid,
        "jti": claims.jti,
        "iat": claims.iat,
        "exp": claims.exp,
        "iss": claims.iss,
        "aud": claims.aud,
        "typ": claims.typ,
    }
    if not settings.jwt_secret:
        raise ValueError("JWT_SECRET is required to issue access tokens")
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token, claims


def decode_access_token(token: str, settings: Settings) -> AccessTokenClaims:
    if not settings.jwt_secret:
        raise ValueError("JWT_SECRET is required to verify access tokens")
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=["HS256"],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
    )
    if payload.get("typ") != ACCESS_TYP:
        raise jwt.InvalidTokenError("Invalid token type")
    return AccessTokenClaims(
        sub=str(payload["sub"]),
        sid=str(payload["sid"]),
        jti=str(payload["jti"]),
        iat=int(payload["iat"]),
        exp=int(payload["exp"]),
        iss=str(payload["iss"]),
        aud=str(payload["aud"] if isinstance(payload["aud"], str) else payload["aud"][0]),
        typ=str(payload["typ"]),
    )


def create_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Store only the hash."""
    raw = generate_opaque_token(nbytes=48)
    return raw, hash_token(raw)
