"""Project domain service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.rls import set_rls_context
from app.models.enums import AuditAction, ProjectStatus
from app.models.project import Project
from app.repositories import ProjectRepository, WorkspaceRepository
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.security.permissions import Permission
from app.services.audit import AuditService
from app.services.authorization import AuthContext, AuthorizationService


class ProjectService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ProjectRepository(session)
        self.workspaces = WorkspaceRepository(session)
        self.authz = AuthorizationService(session)
        self.audit = AuditService(session)

    async def _apply_rls(self, user_id: UUID) -> None:
        workspace_ids = await self.workspaces.list_workspace_ids_for_user(user_id)
        await set_rls_context(self.session, user_id=user_id, workspace_ids=workspace_ids)

    async def list_projects(self, ctx: AuthContext, workspace_id: UUID) -> list[Project]:
        await self._apply_rls(ctx.user_id)
        await self.authz.authorize_workspace_access(ctx, workspace_id, Permission.PROJECT_READ)
        return await self.repo.list_for_workspace(workspace_id)

    async def get_project(self, ctx: AuthContext, project_id: UUID) -> Project:
        await self._apply_rls(ctx.user_id)
        result = await self.authz.authorize_project_access(
            ctx, project_id, Permission.PROJECT_READ
        )
        assert result.project is not None
        return result.project

    async def create_project(self, ctx: AuthContext, data: ProjectCreate) -> Project:
        await self._apply_rls(ctx.user_id)
        # Membership of authenticated user on data.workspace_id — ignore created_by/owner_id
        await self.authz.authorize_workspace_access(
            ctx, data.workspace_id, Permission.PROJECT_WRITE
        )
        project = await self.repo.create(
            name=data.name,
            workspace_id=data.workspace_id,
            created_by=ctx.user_id,
        )
        await self.audit.record(
            action=AuditAction.CREATE.value,
            resource_type="project",
            actor_user_id=ctx.user_id,
            resource_id=str(project.id),
            workspace_id=project.workspace_id,
            request_id=ctx.request_id,
            ip_address=ctx.ip_address,
            message="Project created",
            metadata={
                "ignored_client_created_by": str(data.created_by) if data.created_by else None,
                "ignored_client_owner_id": str(data.owner_id) if data.owner_id else None,
            },
        )
        return project

    async def update_project(
        self, ctx: AuthContext, project_id: UUID, data: ProjectUpdate
    ) -> Project:
        await self._apply_rls(ctx.user_id)
        result = await self.authz.authorize_project_access(
            ctx, project_id, Permission.PROJECT_WRITE
        )
        project = result.project
        assert project is not None
        if data.name is not None:
            project.name = data.name
        if data.status is not None:
            project.status = (
                data.status.value if isinstance(data.status, ProjectStatus) else str(data.status)
            )
        project.version += 1
        from datetime import UTC, datetime

        project.updated_at = datetime.now(UTC)
        await self.session.flush()
        await self.session.refresh(project)
        await self.audit.record(
            action=AuditAction.UPDATE.value,
            resource_type="project",
            actor_user_id=ctx.user_id,
            resource_id=str(project.id),
            workspace_id=project.workspace_id,
            request_id=ctx.request_id,
            ip_address=ctx.ip_address,
            message="Project updated",
        )
        await self.session.refresh(project)
        return project

    async def delete_project(self, ctx: AuthContext, project_id: UUID) -> Project:
        await self._apply_rls(ctx.user_id)
        result = await self.authz.authorize_project_access(
            ctx, project_id, Permission.PROJECT_DELETE
        )
        project = result.project
        assert project is not None
        await self.repo.soft_delete(project)
        await self.audit.record(
            action=AuditAction.DELETE.value,
            resource_type="project",
            actor_user_id=ctx.user_id,
            resource_id=str(project.id),
            workspace_id=project.workspace_id,
            request_id=ctx.request_id,
            ip_address=ctx.ip_address,
            message="Project soft-deleted",
        )
        return project
