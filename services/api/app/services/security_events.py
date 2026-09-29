"""Security event recording service."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SecurityEventType
from app.models.security_event import SecurityEvent
from app.security.redaction import redact_mapping


class SecurityEventService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record(
        self,
        *,
        event_type: SecurityEventType | str,
        message: str,
        severity: str = "warning",
        actor_user_id: UUID | None = None,
        target_user_id: UUID | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        workspace_id: UUID | None = None,
        request_id: str | None = None,
        ip_address: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> SecurityEvent:
        event = SecurityEvent(
            event_type=str(event_type),
            severity=severity,
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            workspace_id=workspace_id,
            request_id=request_id,
            ip_address=ip_address,
            message=message,
            details=redact_mapping(details) if details else None,
        )
        self.session.add(event)
        await self.session.flush()
        return event
