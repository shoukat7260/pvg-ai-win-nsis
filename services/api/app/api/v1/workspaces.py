"""Workspace API routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, status

from app.api.deps import AuthContextDep, DbSessionDep
from app.schemas.workspace import WorkspaceCreate, WorkspaceRead, WorkspaceUpdate
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceRead])
async def list_workspaces(ctx: AuthContextDep, session: DbSessionDep) -> list[WorkspaceRead]:
    workspaces = await WorkspaceService(session).list_workspaces(ctx)
    return [WorkspaceRead.model_validate(w) for w in workspaces]


@router.post("", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> WorkspaceRead:
    workspace = await WorkspaceService(session).create_workspace(ctx, body)
    return WorkspaceRead.model_validate(workspace)


@router.get("/{workspace_id}", response_model=WorkspaceRead)
async def get_workspace(
    workspace_id: UUID,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> WorkspaceRead:
    workspace = await WorkspaceService(session).get_workspace(ctx, workspace_id)
    return WorkspaceRead.model_validate(workspace)


@router.patch("/{workspace_id}", response_model=WorkspaceRead)
async def update_workspace(
    workspace_id: UUID,
    body: WorkspaceUpdate,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> WorkspaceRead:
    workspace = await WorkspaceService(session).update_workspace(ctx, workspace_id, body)
    return WorkspaceRead.model_validate(workspace)


@router.delete("/{workspace_id}", response_model=WorkspaceRead)
async def delete_workspace(
    workspace_id: UUID,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> WorkspaceRead:
    workspace = await WorkspaceService(session).delete_workspace(ctx, workspace_id)
    return WorkspaceRead.model_validate(workspace)
