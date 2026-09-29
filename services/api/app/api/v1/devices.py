"""Device endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUserDep, DbSessionDep
from app.schemas.auth import DeviceRead, DeviceRenameRequest
from app.schemas.common import MessageResponse
from app.services.device_service import DeviceService

router = APIRouter(prefix="/devices", tags=["devices"])


def _to_read(device) -> DeviceRead:
    return DeviceRead(
        id=device.id,
        device_public_id=device.device_public_id,
        name=device.device_name,
        platform=device.platform,
        os_version=device.os_version,
        app_version=device.app_version,
        architecture=device.architecture,
        trusted=device.trusted,
        status=device.status,
        last_seen_at=device.last_seen_at,
        last_ip=device.last_ip,
    )


class DeviceListResponse(BaseModel):
    items: list[DeviceRead]


@router.get("", response_model=DeviceListResponse)
async def list_devices(user: CurrentUserDep, session: DbSessionDep) -> DeviceListResponse:
    devices = await DeviceService(session).list_for_user(user.id)
    return DeviceListResponse(items=[_to_read(d) for d in devices])


@router.patch("/{device_id}", response_model=DeviceRead)
async def rename_device(
    device_id: UUID,
    body: DeviceRenameRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
) -> DeviceRead:
    device = await DeviceService(session).rename(
        user_id=user.id, device_id=device_id, name=body.name
    )
    return _to_read(device)


@router.post("/{device_id}/revoke", response_model=DeviceRead)
async def revoke_device(
    device_id: UUID, user: CurrentUserDep, session: DbSessionDep
) -> DeviceRead:
    device = await DeviceService(session).revoke(user_id=user.id, device_id=device_id)
    return _to_read(device)


@router.post("/revoke-others", response_model=MessageResponse)
async def revoke_other_devices(
    user: CurrentUserDep, session: DbSessionDep, keep_device_id: UUID | None = None
) -> MessageResponse:
    # Prefer current session's device when available — client may pass keep_device_id
    if keep_device_id is None:
        devices = await DeviceService(session).list_for_user(user.id)
        keep_device_id = devices[0].id if devices else None
    if keep_device_id is None:
        return MessageResponse(message="No devices")
    count = await DeviceService(session).revoke_others(
        user_id=user.id, keep_device_id=keep_device_id
    )
    return MessageResponse(message=f"Revoked {count} devices")
