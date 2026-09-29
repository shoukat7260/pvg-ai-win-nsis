"""Session management endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUserDep, DbSessionDep, SettingsDep
from app.errors import UnauthorizedError
from app.schemas.auth import SessionRead
from app.schemas.common import MessageResponse
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


class SessionListResponse(BaseModel):
    items: list[SessionRead]


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    user: CurrentUserDep, session: DbSessionDep, settings: SettingsDep
) -> SessionListResponse:
    rows = await SessionService(session, settings).list_for_user(user.id)
    return SessionListResponse(items=[SessionRead.model_validate(r) for r in rows])


@router.post("/{session_id}/revoke", response_model=MessageResponse)
async def revoke_session(
    session_id: UUID,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    await SessionService(session, settings).revoke_session(
        session_id, user_id=user.id, reason="user_revoke"
    )
    return MessageResponse(message="Session revoked")


@router.post("/revoke-others", response_model=MessageResponse)
async def revoke_other_sessions(
    user: CurrentUserDep, session: DbSessionDep, settings: SettingsDep
) -> MessageResponse:
    if not user.session_id:
        raise UnauthorizedError("Current session required")
    count = await SessionService(session, settings).revoke_others(
        user_id=user.id, keep_session_id=user.session_id
    )
    return MessageResponse(message=f"Revoked {count} sessions")
