"""Project API routes."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import AuthContextDep, DbSessionDep
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.project import ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    ctx: AuthContextDep,
    session: DbSessionDep,
    workspace_id: UUID = Query(..., description="Workspace to list projects for"),
) -> list[ProjectRead]:
    projects = await ProjectService(session).list_projects(ctx, workspace_id)
    return [ProjectRead.model_validate(p) for p in projects]


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> ProjectRead:
    project = await ProjectService(session).create_project(ctx, body)
    return ProjectRead.model_validate(project)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> ProjectRead:
    project = await ProjectService(session).get_project(ctx, project_id)
    return ProjectRead.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> ProjectRead:
    project = await ProjectService(session).update_project(ctx, project_id, body)
    return ProjectRead.model_validate(project)


@router.delete("/{project_id}", response_model=ProjectRead)
async def delete_project(
    project_id: UUID,
    ctx: AuthContextDep,
    session: DbSessionDep,
) -> ProjectRead:
    project = await ProjectService(session).delete_project(ctx, project_id)
    return ProjectRead.model_validate(project)
