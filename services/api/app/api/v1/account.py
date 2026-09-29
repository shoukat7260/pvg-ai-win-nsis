"""Account endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import or_, select

from app.api.deps import CurrentUserDep, DbSessionDep, SettingsDep
from app.models.security_event import SecurityEvent
from app.schemas.auth import AccountPatchRequest, EmailChangeRequest, PasswordChangeRequest
from app.schemas.common import MessageResponse
from app.schemas.user import UserRead
from app.services.account_service import AccountService

router = APIRouter(prefix="/account", tags=["account"])


class SecurityEventRead(BaseModel):
    id: UUID
    event_type: str
    message: str
    severity: str
    ip_address: str | None
    created_at: str


class SecurityEventListResponse(BaseModel):
    items: list[SecurityEventRead]


@router.get("", response_model=UserRead)
async def get_account(
    user: CurrentUserDep, session: DbSessionDep, settings: SettingsDep
) -> UserRead:
    row = await AccountService(session, settings).get(user.id)
    return UserRead.model_validate(row)


@router.get("/security-events", response_model=SecurityEventListResponse)
async def list_security_events(
    user: CurrentUserDep, session: DbSessionDep
) -> SecurityEventListResponse:
    result = await session.execute(
        select(SecurityEvent)
        .where(
            or_(
                SecurityEvent.actor_user_id == user.id,
                SecurityEvent.target_user_id == user.id,
            )
        )
        .order_by(SecurityEvent.created_at.desc())
        .limit(50)
    )
    rows = result.scalars().all()
    return SecurityEventListResponse(
        items=[
            SecurityEventRead(
                id=row.id,
                event_type=row.event_type,
                message=row.message,
                severity=row.severity,
                ip_address=row.ip_address,
                created_at=row.created_at.isoformat(),
            )
            for row in rows
        ]
    )


@router.patch("", response_model=UserRead)
async def patch_account(
    body: AccountPatchRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> UserRead:
    row = await AccountService(session, settings).patch(
        user.id, display_name=body.display_name
    )
    return UserRead.model_validate(row)


@router.post("/password", response_model=MessageResponse)
async def change_password(
    body: PasswordChangeRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    await AccountService(session, settings).change_password(
        user.id,
        current_password=body.current_password,
        new_password=body.new_password,
    )
    return MessageResponse(message="Password changed")


@router.post("/email-change", response_model=MessageResponse)
async def email_change(
    body: EmailChangeRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    await AccountService(session, settings).request_email_change(
        user.id, new_email=str(body.new_email)
    )
    return MessageResponse(message="Confirmation email sent")


@router.post("/deactivate", response_model=MessageResponse)
async def deactivate(
    user: CurrentUserDep, session: DbSessionDep, settings: SettingsDep
) -> MessageResponse:
    await AccountService(session, settings).deactivate(user.id)
    return MessageResponse(message="Account deactivated")


@router.post("/delete-request", response_model=MessageResponse)
async def delete_request(
    user: CurrentUserDep, session: DbSessionDep, settings: SettingsDep
) -> MessageResponse:
    await AccountService(session, settings).request_delete(user.id)
    return MessageResponse(message="Account marked for deletion")
