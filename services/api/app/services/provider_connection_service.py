"""Provider connection metadata (never stores raw secrets)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.rls import set_rls_context
from app.errors import NotFoundError, ValidationAppError
from app.models.enums import ConnectionMethod, ProviderConnectionStatus
from app.models.provider import ProviderConnection, ProviderUsageSnapshot
from app.repositories import WorkspaceRepository


FORBIDDEN_SECRET_KEYS = frozenset(
    {
        "api_key",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "password",
        "credential",
        "private_key",
    }
)


class ProviderConnectionService:
    def __init__(self, session: AsyncSession) -> None:
        self.db = session
        self.workspaces = WorkspaceRepository(session)

    async def list_for_user(self, user_id: uuid.UUID) -> list[ProviderConnection]:
        workspace_ids = await self.workspaces.list_workspace_ids_for_user(user_id)
        await set_rls_context(self.db, user_id=user_id, workspace_ids=workspace_ids)
        result = await self.db.execute(
            select(ProviderConnection).where(ProviderConnection.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    async def create_metadata(
        self,
        *,
        user_id: uuid.UUID,
        provider_type: str,
        display_name: str,
        credential_ref: str | None = None,
        workspace_id: uuid.UUID | None = None,
        device_id: uuid.UUID | None = None,
        connection_method: str = ConnectionMethod.API_KEY.value,
        account_label: str | None = None,
        raw_secret: str | None = None,
    ) -> ProviderConnection:
        if raw_secret is not None:
            raise ValidationAppError(
                "Raw provider secrets must not be sent to the API; store them in the local vault"
            )
        if credential_ref and any(k in credential_ref.lower() for k in ("sk-", "api_key=")):
            raise ValidationAppError("credential_ref must not contain raw secret material")

        workspace_ids = await self.workspaces.list_workspace_ids_for_user(user_id)
        await set_rls_context(self.db, user_id=user_id, workspace_ids=workspace_ids)

        conn = ProviderConnection(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            user_id=user_id,
            device_id=device_id,
            provider_type=provider_type,
            display_name=display_name,
            account_label=account_label,
            credential_ref=credential_ref,
            connection_method=connection_method,
            created_by=user_id,
            status=ProviderConnectionStatus.ACTIVE.value,
        )
        self.db.add(conn)
        await self.db.flush()
        return conn

    async def update_status(
        self,
        *,
        user_id: uuid.UUID,
        connection_id: uuid.UUID,
        status: str,
    ) -> ProviderConnection:
        conn = await self._get_owned(user_id, connection_id)
        conn.status = status
        if status == ProviderConnectionStatus.ACTIVE.value:
            conn.last_validated_at = datetime.now(UTC)
        await self.db.flush()
        return conn

    async def delete(self, *, user_id: uuid.UUID, connection_id: uuid.UUID) -> None:
        conn = await self._get_owned(user_id, connection_id)
        conn.deleted_at = datetime.now(UTC)
        await self.db.flush()

    async def add_usage_snapshot(
        self,
        *,
        user_id: uuid.UUID,
        connection_id: uuid.UUID,
        period_start: datetime,
        period_end: datetime,
        request_count: int = 0,
        token_count: int = 0,
    ) -> ProviderUsageSnapshot:
        await self._get_owned(user_id, connection_id)
        snap = ProviderUsageSnapshot(
            id=uuid.uuid4(),
            connection_id=connection_id,
            user_id=user_id,
            period_start=period_start,
            period_end=period_end,
            request_count=request_count,
            token_count=token_count,
        )
        self.db.add(snap)
        await self.db.flush()
        return snap

    async def list_usage(
        self, *, user_id: uuid.UUID, connection_id: uuid.UUID
    ) -> list[ProviderUsageSnapshot]:
        await self._get_owned(user_id, connection_id)
        result = await self.db.execute(
            select(ProviderUsageSnapshot).where(
                ProviderUsageSnapshot.connection_id == connection_id,
                ProviderUsageSnapshot.user_id == user_id,
            )
        )
        return list(result.scalars().all())

    async def _get_owned(
        self, user_id: uuid.UUID, connection_id: uuid.UUID
    ) -> ProviderConnection:
        workspace_ids = await self.workspaces.list_workspace_ids_for_user(user_id)
        await set_rls_context(self.db, user_id=user_id, workspace_ids=workspace_ids)
        result = await self.db.execute(
            select(ProviderConnection).where(
                ProviderConnection.id == connection_id,
                ProviderConnection.deleted_at.is_(None),
            )
        )
        conn = result.scalar_one_or_none()
        if conn is None:
            raise NotFoundError("Connection not found")
        if conn.user_id and conn.user_id != user_id and conn.created_by != user_id:
            raise NotFoundError("Connection not found")
        return conn
