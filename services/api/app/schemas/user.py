"""User schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.models.enums import UserStatus
from app.schemas.common import ORMModel


class UserRead(ORMModel):
    id: UUID
    email: str
    display_name: str
    status: UserStatus
    email_verified_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None
