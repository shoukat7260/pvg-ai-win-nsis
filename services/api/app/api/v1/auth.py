"""Auth endpoints."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, Response
from itsdangerous import URLSafeSerializer

from app.api.deps import (
    CSRF_COOKIE_NAME,
    REFRESH_COOKIE_NAME,
    CurrentUserDep,
    DbSessionDep,
    SettingsDep,
    clear_refresh_cookie,
    set_refresh_cookie,
)
from app.errors import UnauthorizedError
from app.schemas.auth import (
    CsrfResponse,
    LoginRequest,
    LoginResponse,
    MfaChallengeVerifyRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    SessionRead,
    TokenResponse,
    VerifyEmailRequest,
)
from app.schemas.common import MessageResponse
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


@router.post("/register", response_model=UserRead, status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    session: DbSessionDep,
    settings: SettingsDep,
) -> UserRead:
    ip, _ = _client_meta(request)
    user = await AuthService(session, settings).register(
        email=str(body.email),
        password=body.password,
        display_name=body.display_name,
        ip_address=ip,
    )
    return UserRead.model_validate(user)


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: DbSessionDep,
    settings: SettingsDep,
) -> LoginResponse:
    ip, ua = _client_meta(request)
    result = await AuthService(session, settings).login(
        email=str(body.email),
        password=body.password,
        ip_address=ip,
        user_agent=ua,
        device_fingerprint=body.device_fingerprint,
        device_name=body.device_name,
        platform=body.platform,
    )
    if result.mfa_required:
        return LoginResponse(mfa_required=True, challenge_id=result.challenge_id)
    assert result.tokens is not None
    set_refresh_cookie(response, settings, result.tokens.refresh_token)
    return LoginResponse(
        access_token=result.tokens.access_token,
        refresh_token=result.tokens.refresh_token,
        expires_in=result.tokens.expires_in,
        session_id=result.tokens.session_id,
        user_id=result.tokens.user_id,
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    if user.session_id:
        await AuthService(session, settings).logout(
            session_id=user.session_id, user_id=user.id
        )
    clear_refresh_cookie(response, settings)
    return MessageResponse(message="Logged out")


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    session: DbSessionDep,
    settings: SettingsDep,
    body: RefreshRequest | None = None,
) -> TokenResponse:
    ip, ua = _client_meta(request)
    raw = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE_NAME)
    if not raw:
        raise UnauthorizedError("Refresh token required")
    tokens = await AuthService(session, settings).refresh(
        refresh_token=raw, ip_address=ip, user_agent=ua
    )
    set_refresh_cookie(response, settings, tokens.refresh_token)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        session_id=tokens.session_id,
        user_id=tokens.user_id,
    )


@router.get("/session", response_model=SessionRead)
async def current_session(
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> SessionRead:
    if not user.session_id:
        raise UnauthorizedError("No active session")
    row = await AuthService(session, settings).get_session_info(user.session_id)
    if row is None:
        raise UnauthorizedError("No active session")
    return SessionRead.model_validate(row)


@router.post("/verify-email", response_model=UserRead)
async def verify_email(
    body: VerifyEmailRequest,
    session: DbSessionDep,
    settings: SettingsDep,
) -> UserRead:
    user = await AuthService(session, settings).verify_email(token=body.token)
    return UserRead.model_validate(user)


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    body: ResendVerificationRequest,
    request: Request,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    ip, _ = _client_meta(request)
    await AuthService(session, settings).resend_verification(
        email=str(body.email), ip_address=ip
    )
    return MessageResponse(message="If the account exists, a verification email was sent")


@router.post("/request-password-reset", response_model=MessageResponse)
async def request_password_reset(
    body: PasswordResetRequest,
    request: Request,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    ip, _ = _client_meta(request)
    await AuthService(session, settings).request_password_reset(
        email=str(body.email), ip_address=ip
    )
    return MessageResponse(message="If the account exists, a reset email was sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: PasswordResetConfirm,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    await AuthService(session, settings).reset_password(
        token=body.token, new_password=body.new_password
    )
    return MessageResponse(message="Password updated")


@router.post("/mfa/challenge/verify", response_model=TokenResponse)
async def verify_mfa_challenge(
    body: MfaChallengeVerifyRequest,
    request: Request,
    response: Response,
    session: DbSessionDep,
    settings: SettingsDep,
) -> TokenResponse:
    ip, ua = _client_meta(request)
    tokens = await AuthService(session, settings).complete_mfa_challenge(
        challenge_id=body.challenge_id,
        totp_code=body.totp_code,
        recovery_code=body.recovery_code,
        ip_address=ip,
        user_agent=ua,
        device_name=body.device_name,
        platform=body.platform,
    )
    set_refresh_cookie(response, settings, tokens.refresh_token)
    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
        session_id=tokens.session_id,
        user_id=tokens.user_id,
    )


@router.get("/csrf", response_model=CsrfResponse)
async def csrf_token(response: Response, settings: SettingsDep) -> CsrfResponse:
    """Issue CSRF token for cookie-based refresh (double-submit cookie pattern).

    Web clients using the HttpOnly refresh cookie (Secure + SameSite=Lax) must
    send this value in the X-CSRF-Token header on state-changing auth requests.
    """
    serializer = URLSafeSerializer(settings.effective_csrf_secret, salt="pvg-csrf")
    token = serializer.dumps({"v": 1})
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        httponly=False,
        secure=settings.is_production_like,
        samesite="lax",
        max_age=settings.refresh_token_ttl_seconds,
        path="/",
    )
    return CsrfResponse(csrf_token=token)
