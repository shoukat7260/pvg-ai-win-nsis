"""FastAPI dependencies."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import decode_access_token
from app.config import Settings, get_settings
from app.db.session import get_db_session
from app.errors import UnauthorizedError, ValidationAppError, parse_uuid
from app.logging import get_logger
from app.models.enums import SecurityEventType, SessionStatus, UserStatus
from app.repositories import UserRepository
from app.services.authorization import AuthContext
from app.services.security_events import SecurityEventService
from app.services.session_service import SessionService

logger = get_logger(__name__)

SettingsDep = Annotated[Settings, Depends(get_settings)]
DbSessionDep = Annotated[AsyncSession, Depends(get_db_session)]

REFRESH_COOKIE_NAME = "pvg_refresh"
CSRF_COOKIE_NAME = "pvg_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str
    display_name: str
    status: str
    session_id: UUID | None = None


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


async def get_current_user(
    request: Request,
    session: DbSessionDep,
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
    x_test_user_id: Annotated[str | None, Header(alias="X-Test-User-Id")] = None,
) -> CurrentUser:
    """Resolve authenticated identity.

    Prefer Bearer JWT access tokens. X-Test-User-Id is allowed ONLY when APP_ENV=test.
    Client-supplied user_id/owner_id query/body fields are never authoritative.
    """
    request_id = getattr(request.state, "request_id", None)
    ip_address = request.client.host if request.client else None

    if x_test_user_id is not None:
        if not settings.allow_test_auth_header:
            security = SecurityEventService(session)
            await security.record(
                event_type=SecurityEventType.TEST_AUTH_REFUSED,
                message="X-Test-User-Id refused outside APP_ENV=test",
                severity="critical",
                request_id=request_id,
                ip_address=ip_address,
                details={"app_env": settings.app_env},
            )
            await session.commit()
            logger.warning(
                "test_auth_refused",
                app_env=settings.app_env,
                request_id=request_id,
            )
            raise UnauthorizedError("Test authentication is not available in this environment")

        try:
            user_id = parse_uuid(x_test_user_id, field="X-Test-User-Id")
        except ValidationAppError as exc:
            raise UnauthorizedError("Invalid test user id") from exc

        from app.db.rls import set_auth_lookup, set_rls_context

        await set_auth_lookup(session, enabled=True)
        try:
            user = await UserRepository(session).get_by_id(user_id)
        finally:
            await set_auth_lookup(session, enabled=False)

        if user is None or user.status in (
            UserStatus.DISABLED.value,
            UserStatus.DELETED.value,
            "disabled",
        ):
            raise UnauthorizedError("Unknown or disabled test user")

        await set_rls_context(session, user_id=user.id, workspace_ids=[])
        return CurrentUser(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            status=user.status,
        )

    bearer = _extract_bearer(authorization)
    if bearer:
        from app.db.rls import set_auth_lookup, set_rls_context

        try:
            claims = decode_access_token(bearer, settings)
        except (jwt.PyJWTError, ValueError, KeyError) as exc:
            raise UnauthorizedError("Invalid or expired access token") from exc

        try:
            user_id = parse_uuid(claims.sub, field="sub")
            session_id = parse_uuid(claims.sid, field="sid")
        except ValidationAppError as exc:
            raise UnauthorizedError("Invalid access token claims") from exc

        auth_session = await SessionService(session, settings).get_active(session_id)
        if auth_session is None or auth_session.user_id != user_id:
            raise UnauthorizedError("Session is not active")
        if auth_session.status != SessionStatus.ACTIVE.value:
            raise UnauthorizedError("Session is not active")

        await set_auth_lookup(session, enabled=True)
        try:
            user = await UserRepository(session).get_by_id(user_id)
        finally:
            await set_auth_lookup(session, enabled=False)

        if user is None or user.status in (
            UserStatus.DISABLED.value,
            UserStatus.DELETED.value,
            UserStatus.SUSPENDED.value,
        ):
            raise UnauthorizedError("Unknown or disabled user")

        await set_rls_context(session, user_id=user.id, workspace_ids=[])
        await SessionService(session, settings).touch(session_id)
        return CurrentUser(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            status=user.status,
            session_id=session_id,
        )

    raise UnauthorizedError("Authentication required")


async def get_auth_context(
    request: Request,
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> AuthContext:
    return AuthContext(
        user_id=user.id,
        request_id=getattr(request.state, "request_id", None),
        ip_address=request.client.host if request.client else None,
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
AuthContextDep = Annotated[AuthContext, Depends(get_auth_context)]


def set_refresh_cookie(response, settings: Settings, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.is_production_like or settings.app_env == "staging",
        samesite="lax",
        max_age=settings.refresh_token_ttl_seconds,
        path="/api/v1/auth",
    )


def clear_refresh_cookie(response, settings: Settings) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        samesite="lax",
        secure=settings.is_production_like or settings.app_env == "staging",
        httponly=True,
    )
