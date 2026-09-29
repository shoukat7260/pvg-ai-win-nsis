"""Audit log service."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.security.redaction import redact_mapping


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record(
        self,
        *,
        action: str,
        resource_type: str,
        actor_user_id: UUID | None = None,
        resource_id: str | None = None,
        workspace_id: UUID | None = None,
        request_id: str | None = None,
        ip_address: str | None = None,
        message: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            workspace_id=workspace_id,
            request_id=request_id,
            ip_address=ip_address,
            message=message,
            metadata_json=redact_mapping(metadata) if metadata else None,
        )
        self.session.add(entry)
        await self.session.flush()
        return entry
