"""Project schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import ProjectStatus
from app.schemas.common import ORMModel


class ProjectCreate(ORMModel):
    name: str = Field(..., min_length=1, max_length=255)
    workspace_id: UUID
    # Client-supplied creator/owner claims are ignored
    created_by: UUID | None = Field(
        default=None,
        description="Ignored. Creator is derived from authenticated identity.",
    )
    owner_id: UUID | None = Field(
        default=None,
        description="Ignored. Not used for authorization.",
    )


class ProjectUpdate(ORMModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    status: ProjectStatus | None = None


class ProjectRead(ORMModel):
    id: UUID
    workspace_id: UUID
    name: str
    schema_version: int
    status: ProjectStatus
    created_by: UUID
    version: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None
