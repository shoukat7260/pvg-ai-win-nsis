"""Device registration model."""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import DeviceStatus


def _public_id() -> str:
    return secrets.token_urlsafe(16)


class Device(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "devices"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_public_id: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, default=_public_id
    )
    device_name: Mapped[str] = mapped_column(String(255), nullable=False)
    device_fingerprint: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    platform: Mapped[str | None] = mapped_column(String(64), nullable=True)
    os_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    architecture: Mapped[str | None] = mapped_column(String(32), nullable=True)
    trusted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=DeviceStatus.PENDING.value
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", back_populates="devices")
    sessions = relationship("AuthSession", back_populates="device")

    @property
    def name(self) -> str:
        return self.device_name
