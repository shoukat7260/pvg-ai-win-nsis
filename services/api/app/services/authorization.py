"""Authorization service — never trusts client-provided ownership IDs."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ForbiddenError, NotFoundError
from app.logging import get_logger
from app.models.enums import SecurityEventType, WorkspaceRole
from app.models.project import Project
from app.models.workspace import Workspace
from app.repositories import (
    AssetRepository,
    GenerationRepository,
    ProjectRepository,
    ProviderConnectionRepository,
    WorkspaceRepository,
)
from app.security.permissions import Permission, role_has_permission
from app.services.security_events import SecurityEventService

logger = get_logger(__name__)


@dataclass(frozen=True)
class AuthContext:
    """Authenticated identity. Ownership IDs from clients are never used."""

    user_id: UUID
    request_id: str | None = None
    ip_address: str | None = None


@dataclass(frozen=True)
class AuthorizationResult:
    allowed: bool
    role: WorkspaceRole | None = None
    workspace: Workspace | None = None
    project: Project | None = None


class AuthorizationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.workspaces = WorkspaceRepository(session)
        self.projects = ProjectRepository(session)
        self.assets = AssetRepository(session)
        self.generations = GenerationRepository(session)
        self.connections = ProviderConnectionRepository(session)
        self.security_events = SecurityEventService(session)

    async def _deny(
        self,
        ctx: AuthContext,
        *,
        permission: Permission,
        resource_type: str,
        resource_id: UUID | str | None,
        workspace_id: UUID | None = None,
        not_found: bool = False,
    ) -> None:
        await self.security_events.record(
            event_type=SecurityEventType.AUTHORIZATION_DENIED,
            message=f"Denied {permission.value} on {resource_type}",
            actor_user_id=ctx.user_id,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            workspace_id=workspace_id,
            request_id=ctx.request_id,
            ip_address=ctx.ip_address,
            details={"permission": permission.value},
        )
        # Persist deny telemetry even though the request will fail and roll back work
        await self.session.commit()
        logger.warning(
            "authorization_denied",
            user_id=str(ctx.user_id),
            permission=permission.value,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
        )
        if not_found:
            raise NotFoundError(f"{resource_type} not found")
        raise ForbiddenError("You do not have permission to perform this action")

    async def authorize_workspace_access(
        self,
        ctx: AuthContext,
        workspace_id: UUID,
        permission: Permission,
    ) -> AuthorizationResult:
        workspace = await self.workspaces.get_by_id(workspace_id)
        if workspace is None:
            await self._deny(
                ctx,
                permission=permission,
                resource_type="workspace",
                resource_id=workspace_id,
                not_found=True,
            )

        membership = await self.workspaces.get_membership(workspace_id, ctx.user_id)
        if membership is None:
            # Prefer 404 to avoid leaking existence across tenants
            await self._deny(
                ctx,
                permission=permission,
                resource_type="workspace",
                resource_id=workspace_id,
                workspace_id=workspace_id,
                not_found=True,
            )

        role = WorkspaceRole(membership.role)
        if not role_has_permission(role, permission):
            await self._deny(
                ctx,
                permission=permission,
                resource_type="workspace",
                resource_id=workspace_id,
                workspace_id=workspace_id,
            )

        return AuthorizationResult(allowed=True, role=role, workspace=workspace)

    async def authorize_project_access(
        self,
        ctx: AuthContext,
        project_id: UUID,
        permission: Permission,
    ) -> AuthorizationResult:
        project = await self.projects.get_by_id(project_id)
        if project is None:
            await self._deny(
                ctx,
                permission=permission,
                resource_type="project",
                resource_id=project_id,
                not_found=True,
            )

        # Authz via workspace membership of authenticated user — ignore any client owner claim
        result = await self.authorize_workspace_access(ctx, project.workspace_id, permission)
        return AuthorizationResult(
            allowed=True,
            role=result.role,
            workspace=result.workspace,
            project=project,
        )

    async def authorize_asset_access(
        self,
        ctx: AuthContext,
        asset_id: UUID,
        permission: Permission,
    ) -> AuthorizationResult:
        asset = await self.assets.get_by_id(asset_id)
        if asset is None:
            await self._deny(
                ctx,
                permission=permission,
                resource_type="asset",
                resource_id=asset_id,
                not_found=True,
            )
        return await self.authorize_workspace_access(ctx, asset.workspace_id, permission)

    async def authorize_generation_access(
        self,
        ctx: AuthContext,
        job_id: UUID,
        permission: Permission,
    ) -> AuthorizationResult:
        job = await self.generations.get_by_id(job_id)
        if job is None:
            await self._deny(
                ctx,
                permission=permission,
                resource_type="generation_job",
                resource_id=job_id,
                not_found=True,
            )
        return await self.authorize_workspace_access(ctx, job.workspace_id, permission)

    async def authorize_provider_connection_access(
        self,
        ctx: AuthContext,
        connection_id: UUID,
        permission: Permission,
    ) -> AuthorizationResult:
        connection = await self.connections.get_by_id(connection_id)
        if connection is None:
            await self._deny(
                ctx,
                permission=permission,
                resource_type="provider_connection",
                resource_id=connection_id,
                not_found=True,
            )
        return await self.authorize_workspace_access(ctx, connection.workspace_id, permission)


# Convenience aliases matching the architecture docs
async def authorize_workspace_access(
    session: AsyncSession,
    ctx: AuthContext,
    workspace_id: UUID,
    permission: Permission,
) -> AuthorizationResult:
    return await AuthorizationService(session).authorize_workspace_access(
        ctx, workspace_id, permission
    )


async def authorize_project_access(
    session: AsyncSession,
    ctx: AuthContext,
    project_id: UUID,
    permission: Permission,
) -> AuthorizationResult:
    return await AuthorizationService(session).authorize_project_access(ctx, project_id, permission)


async def authorize_asset_access(
    session: AsyncSession,
    ctx: AuthContext,
    asset_id: UUID,
    permission: Permission,
) -> AuthorizationResult:
    return await AuthorizationService(session).authorize_asset_access(ctx, asset_id, permission)


async def authorize_generation_access(
    session: AsyncSession,
    ctx: AuthContext,
    job_id: UUID,
    permission: Permission,
) -> AuthorizationResult:
    return await AuthorizationService(session).authorize_generation_access(ctx, job_id, permission)


async def authorize_provider_connection_access(
    session: AsyncSession,
    ctx: AuthContext,
    connection_id: UUID,
    permission: Permission,
) -> AuthorizationResult:
    return await AuthorizationService(session).authorize_provider_connection_access(
        ctx, connection_id, permission
    )
