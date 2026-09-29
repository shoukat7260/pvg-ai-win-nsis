"""Device registration and revocation."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.db.rls import set_rls_context
from app.models.device import Device
from app.models.enums import DeviceStatus, SessionStatus
from app.models.session import AuthSession


class DeviceService:
    def __init__(self, session: AsyncSession) -> None:
        self.db = session

    async def upsert(
        self,
        *,
        user_id: uuid.UUID,
        fingerprint: str,
        name: str,
        platform: str | None = None,
        os_version: str | None = None,
        app_version: str | None = None,
        architecture: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> Device:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        result = await self.db.execute(
            select(Device).where(Device.device_fingerprint == fingerprint)
        )
        device = result.scalar_one_or_none()
        now = datetime.now(UTC)
        if device is None:
            device = Device(
                id=uuid.uuid4(),
                user_id=user_id,
                device_public_id=secrets.token_urlsafe(16),
                device_name=name,
                device_fingerprint=fingerprint,
                platform=platform,
                os_version=os_version,
                app_version=app_version,
                architecture=architecture,
                status=DeviceStatus.ACTIVE.value,
                last_seen_at=now,
                last_ip=ip_address,
                user_agent=user_agent,
            )
            self.db.add(device)
        else:
            if device.user_id != user_id:
                raise NotFoundError("Device not found")
            device.device_name = name or device.device_name
            device.platform = platform or device.platform
            device.os_version = os_version or device.os_version
            device.app_version = app_version or device.app_version
            device.architecture = architecture or device.architecture
            device.last_seen_at = now
            device.last_ip = ip_address
            device.user_agent = user_agent
            if device.status == DeviceStatus.REVOKED.value:
                device.status = DeviceStatus.ACTIVE.value
                device.revoked_at = None
        await self.db.flush()
        return device

    async def list_for_user(self, user_id: uuid.UUID) -> list[Device]:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        result = await self.db.execute(
            select(Device)
            .where(Device.user_id == user_id)
            .order_by(Device.created_at.desc())
        )
        return list(result.scalars().all())

    async def rename(self, *, user_id: uuid.UUID, device_id: uuid.UUID, name: str) -> Device:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        device = await self._get_owned(user_id, device_id)
        device.device_name = name
        await self.db.flush()
        return device

    async def revoke(self, *, user_id: uuid.UUID, device_id: uuid.UUID) -> Device:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        device = await self._get_owned(user_id, device_id)
        now = datetime.now(UTC)
        device.status = DeviceStatus.REVOKED.value
        device.revoked_at = now
        await self.db.execute(
            update(AuthSession)
            .where(
                AuthSession.device_id == device_id,
                AuthSession.user_id == user_id,
                AuthSession.status == SessionStatus.ACTIVE.value,
            )
            .values(
                status=SessionStatus.REVOKED.value,
                revoked_at=now,
                revoke_reason="device_revoked",
                refresh_token_hash=None,
            )
        )
        await self.db.flush()
        return device

    async def revoke_others(self, *, user_id: uuid.UUID, keep_device_id: uuid.UUID) -> int:
        devices = await self.list_for_user(user_id)
        count = 0
        for device in devices:
            if device.id != keep_device_id and device.status != DeviceStatus.REVOKED.value:
                await self.revoke(user_id=user_id, device_id=device.id)
                count += 1
        return count

    async def _get_owned(self, user_id: uuid.UUID, device_id: uuid.UUID) -> Device:
        result = await self.db.execute(
            select(Device).where(Device.id == device_id, Device.user_id == user_id)
        )
        device = result.scalar_one_or_none()
        if device is None:
            raise NotFoundError("Device not found")
        return device
