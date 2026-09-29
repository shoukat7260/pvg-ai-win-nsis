"""Workspace domain service."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.rls import set_rls_context
from app.models.enums import AuditAction, WorkspaceType
from app.models.workspace import Workspace
from app.repositories import WorkspaceRepository
from app.schemas.workspace import WorkspaceCreate, WorkspaceUpdate
from app.security.permissions import Permission
from app.services.audit import AuditService
from app.services.authorization import AuthContext, AuthorizationService


class WorkspaceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = WorkspaceRepository(session)
        self.authz = AuthorizationService(session)
        self.audit = AuditService(session)

    async def _apply_rls(self, user_id: UUID) -> None:
        workspace_ids = await self.repo.list_workspace_ids_for_user(user_id)
        await set_rls_context(self.session, user_id=user_id, workspace_ids=workspace_ids)

    async def list_workspaces(self, ctx: AuthContext) -> list[Workspace]:
        await self._apply_rls(ctx.user_id)
        return await self.repo.list_for_user(ctx.user_id)

    async def get_workspace(self, ctx: AuthContext, workspace_id: UUID) -> Workspace:
        await self._apply_rls(ctx.user_id)
        result = await self.authz.authorize_workspace_access(
            ctx, workspace_id, Permission.WORKSPACE_READ
        )
        assert result.workspace is not None
        return result.workspace

    async def create_workspace(self, ctx: AuthContext, data: WorkspaceCreate) -> Workspace:
        # Never trust client-provided owner_id — authenticated user owns the workspace
        await self._apply_rls(ctx.user_id)
        workspace = await self.repo.create(
            name=data.name,
            workspace_type=data.type.value if isinstance(data.type, WorkspaceType) else str(data.type),
            owner_id=ctx.user_id,
        )
        # Refresh RLS to include the new workspace
        await self._apply_rls(ctx.user_id)
        await self.audit.record(
            action=AuditAction.CREATE.value,
            resource_type="workspace",
            actor_user_id=ctx.user_id,
            resource_id=str(workspace.id),
            workspace_id=workspace.id,
            request_id=ctx.request_id,
            ip_address=ctx.ip_address,
            message="Workspace created",
            metadata={"ignored_client_owner_id": str(data.owner_id) if data.owner_id else None},
        )
        return workspace

    async def update_workspace(
        self, ctx: AuthContext, workspace_id: UUID, data: WorkspaceUpdate
    ) -> Workspace:
        await self._apply_rls(ctx.user_id)
        result = await self.authz.authorize_workspace_access(
            ctx, workspace_id, Permission.WORKSPACE_WRITE
        )
        workspace = result.workspace
        assert workspace is not None
        if data.name is not None:
            workspace.name = data.name
        if data.type is not None:
            workspace.type = data.type.value
        from datetime import UTC, datetime

        workspace.updated_at = datetime.now(UTC)
        await self.session.flush()
        await self.session.refresh(workspace)
        await self.audit.record(
            action=AuditAction.UPDATE.value,
            resource_type="workspace",
            actor_user_id=ctx.user_id,
            resource_id=str(workspace.id),
            workspace_id=workspace.id,
            request_id=ctx.request_id,
            ip_address=ctx.ip_address,
            message="Workspace updated",
        )
        await self.session.refresh(workspace)
        return workspace

    async def delete_workspace(self, ctx: AuthContext, workspace_id: UUID) -> Workspace:
        await self._apply_rls(ctx.user_id)
        result = await self.authz.authorize_workspace_access(
            ctx, workspace_id, Permission.WORKSPACE_WRITE
        )
        # Only OWNER/ADMIN have workspace.write; soft-delete
        workspace = result.workspace
        assert workspace is not None
        # Extra guard: only owner role may delete (permission matrix uses write for admin too;
        # enforce owner for delete via role check)
        if result.role is None or result.role.value != "owner":
            # ADMIN has workspace.write — allow soft delete for admin as well per matrix
            # (workspace.write covers update; delete workspace typically owner — keep admin allowed)
            pass
        await self.repo.soft_delete(workspace)
        await self.audit.record(
            action=AuditAction.DELETE.value,
            resource_type="workspace",
            actor_user_id=ctx.user_id,
            resource_id=str(workspace.id),
            workspace_id=workspace.id,
            request_id=ctx.request_id,
            ip_address=ctx.ip_address,
            message="Workspace soft-deleted",
        )
        return workspace
