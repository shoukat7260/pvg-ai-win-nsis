"""Provider connection metadata endpoints (no raw secrets)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserDep, DbSessionDep
from app.schemas.common import MessageResponse
from app.services.provider_connection_service import ProviderConnectionService

router = APIRouter(prefix="/connections", tags=["connections"])


class ConnectionCreate(BaseModel):
    provider_type: str
    display_name: str = Field(min_length=1, max_length=255)
    credential_ref: str | None = None
    workspace_id: UUID | None = None
    device_id: UUID | None = None
    connection_method: str = "api_key"
    account_label: str | None = None
    # Explicitly rejected if present
    api_key: str | None = None
    secret: str | None = None


class ConnectionRead(BaseModel):
    id: UUID
    provider_type: str
    display_name: str
    account_label: str | None
    credential_ref: str | None
    connection_method: str
    status: str
    workspace_id: UUID | None
    user_id: UUID | None
    device_id: UUID | None
    last_validated_at: datetime | None

    model_config = {"from_attributes": True}


class ConnectionStatusUpdate(BaseModel):
    status: str


class UsageSnapshotCreate(BaseModel):
    period_start: datetime
    period_end: datetime
    request_count: int = 0
    token_count: int = 0


class UsageSnapshotRead(BaseModel):
    id: UUID
    connection_id: UUID
    period_start: datetime
    period_end: datetime
    request_count: int
    token_count: int

    model_config = {"from_attributes": True}


class ConnectionListResponse(BaseModel):
    items: list[ConnectionRead]


@router.get("", response_model=ConnectionListResponse)
async def list_connections(
    user: CurrentUserDep, session: DbSessionDep
) -> ConnectionListResponse:
    rows = await ProviderConnectionService(session).list_for_user(user.id)
    return ConnectionListResponse(items=[ConnectionRead.model_validate(r) for r in rows])


@router.post("", response_model=ConnectionRead, status_code=201)
async def create_connection(
    body: ConnectionCreate, user: CurrentUserDep, session: DbSessionDep
) -> ConnectionRead:
    from app.errors import ValidationAppError

    # Raw provider secrets must NEVER be accepted by the cloud API.
    if body.api_key or body.secret:
        raise ValidationAppError(
            "Provider secrets must be stored in the local vault only; "
            "do not send api_key/secret to the PVG API."
        )
    row = await ProviderConnectionService(session).create_metadata(
        user_id=user.id,
        provider_type=body.provider_type,
        display_name=body.display_name,
        credential_ref=body.credential_ref,
        workspace_id=body.workspace_id,
        device_id=body.device_id,
        connection_method=body.connection_method,
        account_label=body.account_label,
        raw_secret=None,
    )
    return ConnectionRead.model_validate(row)


@router.patch("/{connection_id}", response_model=ConnectionRead)
async def update_connection(
    connection_id: UUID,
    body: ConnectionStatusUpdate,
    user: CurrentUserDep,
    session: DbSessionDep,
) -> ConnectionRead:
    row = await ProviderConnectionService(session).update_status(
        user_id=user.id, connection_id=connection_id, status=body.status
    )
    return ConnectionRead.model_validate(row)


@router.delete("/{connection_id}", response_model=MessageResponse)
async def delete_connection(
    connection_id: UUID, user: CurrentUserDep, session: DbSessionDep
) -> MessageResponse:
    await ProviderConnectionService(session).delete(
        user_id=user.id, connection_id=connection_id
    )
    return MessageResponse(message="Connection deleted")


@router.get("/{connection_id}/usage", response_model=list[UsageSnapshotRead])
async def list_usage(
    connection_id: UUID, user: CurrentUserDep, session: DbSessionDep
) -> list[UsageSnapshotRead]:
    rows = await ProviderConnectionService(session).list_usage(
        user_id=user.id, connection_id=connection_id
    )
    return [UsageSnapshotRead.model_validate(r) for r in rows]


@router.post("/{connection_id}/usage", response_model=UsageSnapshotRead, status_code=201)
async def create_usage(
    connection_id: UUID,
    body: UsageSnapshotCreate,
    user: CurrentUserDep,
    session: DbSessionDep,
) -> UsageSnapshotRead:
    row = await ProviderConnectionService(session).add_usage_snapshot(
        user_id=user.id,
        connection_id=connection_id,
        period_start=body.period_start,
        period_end=body.period_end,
        request_count=body.request_count,
        token_count=body.token_count,
    )
    return UsageSnapshotRead.model_validate(row)
