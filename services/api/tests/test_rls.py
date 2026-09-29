"""RLS isolation tests — require PostgreSQL + pvg_app role."""

from __future__ import annotations

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.rls import set_rls_context
from app.models.project import Project
from app.models.workspace import Workspace
from tests.conftest import TenantFixture


@pytest.mark.asyncio
async def test_rls_hides_foreign_workspace(
    db_session: AsyncSession,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
) -> None:
    await set_rls_context(
        db_session,
        user_id=tenant_a.user.id,
        workspace_ids=[tenant_a.workspace.id],
    )
    result = await db_session.execute(select(Workspace).where(Workspace.id == tenant_b.workspace.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_rls_allows_own_workspace(
    db_session: AsyncSession,
    tenant_a: TenantFixture,
) -> None:
    await set_rls_context(
        db_session,
        user_id=tenant_a.user.id,
        workspace_ids=[tenant_a.workspace.id],
    )
    result = await db_session.execute(select(Workspace).where(Workspace.id == tenant_a.workspace.id))
    assert result.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_rls_hides_foreign_project(
    db_session: AsyncSession,
    tenant_a: TenantFixture,
    tenant_b: TenantFixture,
) -> None:
    await set_rls_context(
        db_session,
        user_id=tenant_a.user.id,
        workspace_ids=[tenant_a.workspace.id],
    )
    result = await db_session.execute(select(Project).where(Project.id == tenant_b.project.id))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_rls_empty_context_sees_nothing(
    db_session: AsyncSession,
    tenant_a: TenantFixture,
) -> None:
    await set_rls_context(db_session, user_id=None, workspace_ids=[])
    result = await db_session.execute(select(Workspace))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_rls_guc_is_transaction_local(db_session: AsyncSession, tenant_a: TenantFixture) -> None:
    await set_rls_context(
        db_session,
        user_id=tenant_a.user.id,
        workspace_ids=[tenant_a.workspace.id],
    )
    row = await db_session.execute(text("SELECT current_setting('app.current_user_id', true)"))
    assert row.scalar_one() == str(tenant_a.user.id)
