"""Workspace schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import WorkspaceType
from app.schemas.common import ORMModel


class WorkspaceCreate(ORMModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: WorkspaceType = WorkspaceType.PERSONAL
    # Intentionally ignored for authorization — owner is always the authenticated user
    owner_id: UUID | None = Field(
        default=None,
        description="Ignored. Ownership is derived from authenticated identity.",
    )


class WorkspaceUpdate(ORMModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    type: WorkspaceType | None = None


class WorkspaceRead(ORMModel):
    id: UUID
    name: str
    type: WorkspaceType
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
