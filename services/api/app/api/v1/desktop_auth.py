"""Desktop browser→app PKCE auth endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserDep, DbSessionDep, SettingsDep
from app.schemas.auth import TokenResponse
from app.services.oauth_google import DesktopAuthService

router = APIRouter(prefix="/auth/desktop", tags=["desktop-auth"])


class DesktopStartRequest(BaseModel):
    code_challenge: str = Field(min_length=43, max_length=128)
    code_challenge_method: str = "S256"
    redirect_uri: str | None = None
    state: str | None = None


class DesktopStartResponse(BaseModel):
    auth_request_id: str
    state: str
    expires_at: str


class DesktopCompleteRequest(BaseModel):
    auth_request_id: UUID
    state: str


class DesktopCompleteResponse(BaseModel):
    code: str
    redirect_uri: str


class DesktopExchangeRequest(BaseModel):
    code: str
    code_verifier: str
    state: str


class DesktopPollResponse(BaseModel):
    status: str
    expires_at: str


@router.post("/start", response_model=DesktopStartResponse)
async def desktop_start(
    body: DesktopStartRequest,
    session: DbSessionDep,
    settings: SettingsDep,
) -> DesktopStartResponse:
    data = await DesktopAuthService(session, settings).start(
        code_challenge=body.code_challenge,
        code_challenge_method=body.code_challenge_method,
        redirect_uri=body.redirect_uri,
        state=body.state,
    )
    return DesktopStartResponse(
        auth_request_id=data["auth_request_id"],
        state=data["state"],
        expires_at=data["expires_at"],
    )


@router.post("/complete", response_model=DesktopCompleteResponse)
async def desktop_complete(
    body: DesktopCompleteRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> DesktopCompleteResponse:
    data = await DesktopAuthService(session, settings).complete_for_user(
        auth_request_id=body.auth_request_id,
        user_id=user.id,
        state=body.state,
    )
    return DesktopCompleteResponse(code=data["code"], redirect_uri=data["redirect_uri"])


@router.post("/exchange", response_model=TokenResponse)
async def desktop_exchange(
    body: DesktopExchangeRequest,
    session: DbSessionDep,
    settings: SettingsDep,
) -> TokenResponse:
    data = await DesktopAuthService(session, settings).exchange(
        code=body.code,
        code_verifier=body.code_verifier,
        state=body.state,
    )
    return TokenResponse(
        access_token=data["access_token"],
        refresh_token=data["refresh_token"],
        expires_in=data["expires_in"],
        session_id=UUID(data["session_id"]),
        user_id=UUID(data["user_id"]),
    )


@router.get("/poll/{auth_request_id}", response_model=DesktopPollResponse)
async def desktop_poll(
    auth_request_id: UUID,
    session: DbSessionDep,
    settings: SettingsDep,
) -> DesktopPollResponse:
    data = await DesktopAuthService(session, settings).poll(auth_request_id=auth_request_id)
    return DesktopPollResponse(**data)
