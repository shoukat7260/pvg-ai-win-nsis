"""Repository helpers."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.generation import GenerationJob
from app.models.project import Project
from app.models.provider import ProviderConnection
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        normalized = email.strip().lower()
        result = await self.session.execute(
            select(User).where(User.normalized_email == normalized)
        )
        return result.scalar_one_or_none()


class WorkspaceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, workspace_id: UUID, *, include_deleted: bool = False) -> Workspace | None:
        stmt = select(Workspace).where(Workspace.id == workspace_id)
        if not include_deleted:
            stmt = stmt.where(Workspace.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_user(self, user_id: UUID) -> list[Workspace]:
        stmt = (
            select(Workspace)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .where(
                WorkspaceMember.user_id == user_id,
                Workspace.deleted_at.is_(None),
            )
            .order_by(Workspace.created_at.desc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_membership(self, workspace_id: UUID, user_id: UUID) -> WorkspaceMember | None:
        result = await self.session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.workspace_id == workspace_id,
                WorkspaceMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_workspace_ids_for_user(self, user_id: UUID) -> list[UUID]:
        result = await self.session.execute(
            select(WorkspaceMember.workspace_id).where(WorkspaceMember.user_id == user_id)
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        name: str,
        workspace_type: str,
        owner_id: UUID,
    ) -> Workspace:
        workspace = Workspace(name=name, type=workspace_type, owner_id=owner_id)
        self.session.add(workspace)
        await self.session.flush()
        member = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=owner_id,
            role="owner",
        )
        self.session.add(member)
        await self.session.flush()
        await self.session.refresh(workspace)
        return workspace

    async def soft_delete(self, workspace: Workspace) -> Workspace:
        workspace.deleted_at = datetime.now(UTC)
        await self.session.flush()
        return workspace


class ProjectRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, project_id: UUID, *, include_deleted: bool = False) -> Project | None:
        stmt = select(Project).where(Project.id == project_id)
        if not include_deleted:
            stmt = stmt.where(Project.deleted_at.is_(None))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_workspace(self, workspace_id: UUID) -> list[Project]:
        result = await self.session.execute(
            select(Project)
            .where(Project.workspace_id == workspace_id, Project.deleted_at.is_(None))
            .order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        *,
        name: str,
        workspace_id: UUID,
        created_by: UUID,
    ) -> Project:
        project = Project(
            name=name,
            workspace_id=workspace_id,
            created_by=created_by,
        )
        self.session.add(project)
        await self.session.flush()
        await self.session.refresh(project)
        return project

    async def soft_delete(self, project: Project) -> Project:
        project.deleted_at = datetime.now(UTC)
        await self.session.flush()
        return project


class AssetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, asset_id: UUID) -> Asset | None:
        result = await self.session.execute(
            select(Asset).where(Asset.id == asset_id, Asset.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()


class GenerationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, job_id: UUID) -> GenerationJob | None:
        result = await self.session.execute(
            select(GenerationJob).where(
                GenerationJob.id == job_id,
                GenerationJob.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()


class ProviderConnectionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, connection_id: UUID) -> ProviderConnection | None:
        result = await self.session.execute(
            select(ProviderConnection).where(
                ProviderConnection.id == connection_id,
                ProviderConnection.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()
