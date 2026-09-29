"""Provider connection metadata (no raw secrets).

Dual-scope: rows may be workspace-scoped (Phase 1) and/or user/device-scoped
(Phase 2 desktop vault metadata). workspace_id is nullable so personal device
connections do not require a workspace; when present, workspace RLS still applies.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ConnectionMethod, ProviderConnectionStatus, ProviderType


class ProviderConnection(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "provider_connections"

    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    device_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    provider_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ProviderType.OTHER.value
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Reference into local CredentialVault — never a raw secret
    credential_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    connection_method: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ConnectionMethod.API_KEY.value
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ProviderConnectionStatus.ACTIVE.value
    )
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProviderUsageSnapshot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "provider_usage_snapshots"

    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("provider_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)
