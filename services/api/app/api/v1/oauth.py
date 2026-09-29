"""Google OAuth endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response
from pydantic import BaseModel

from app.api.deps import DbSessionDep, SettingsDep, set_refresh_cookie
from app.errors import ValidationAppError
from app.schemas.auth import TokenResponse
from app.services.oauth_google import GoogleOAuthService

router = APIRouter(prefix="/oauth/google", tags=["oauth"])

# In-memory state store for tests/dev (replace with Redis/signed cookie in production)
_oauth_states: dict[str, str] = {}


class AuthorizeResponse(BaseModel):
    authorize_url: str
    state: str


@router.get("/authorize", response_model=AuthorizeResponse)
async def authorize(session: DbSessionDep, settings: SettingsDep) -> AuthorizeResponse:
    svc = GoogleOAuthService(session, settings)
    state = GoogleOAuthService.new_state()
    _oauth_states[state] = state
    url = svc.build_authorize_url(state=state)
    return AuthorizeResponse(authorize_url=url, state=state)


@router.get("/callback", response_model=TokenResponse)
async def callback(
    request: Request,
    response: Response,
    session: DbSessionDep,
    settings: SettingsDep,
    code: str = Query(...),
    state: str = Query(...),
) -> TokenResponse:
    expected = _oauth_states.pop(state, None)
    if expected is None:
        raise ValidationAppError("Unknown or expired OAuth state")
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    _user, access, refresh, session_id = await GoogleOAuthService(
        session, settings
    ).handle_callback(
        code=code,
        state=state,
        expected_state=expected,
        ip_address=ip,
        user_agent=ua,
    )
    set_refresh_cookie(response, settings, refresh)
    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_ttl_seconds,
        session_id=session_id,
        user_id=_user.id,
    )


# Test helper to inject state (used by oauth security tests)
def store_oauth_state(state: str) -> None:
    _oauth_states[state] = state
