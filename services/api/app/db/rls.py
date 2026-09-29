"""Row-level security session context helpers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_rls_context(
    session: AsyncSession,
    *,
    user_id: UUID | None,
    workspace_ids: list[UUID] | None = None,
) -> None:
    """Set transaction-local GUCs used by RLS policies.

    Uses set_config(..., true) so values are transaction-scoped (PgBouncer-safe).
    """
    user_value = str(user_id) if user_id else ""
    ws_value = ",".join(str(w) for w in (workspace_ids or []))
    await session.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": user_value},
    )
    await session.execute(
        text("SELECT set_config('app.current_workspace_ids', :wids, true)"),
        {"wids": ws_value},
    )


async def set_auth_lookup(session: AsyncSession, *, enabled: bool) -> None:
    """Allow hash-based auth token lookups before user identity is known.

    Used only inside trusted server-side token rotation / verification paths.
    """
    await session.execute(
        text("SELECT set_config('app.auth_lookup', :flag, true)"),
        {"flag": "1" if enabled else ""},
    )


async def clear_rls_context(session: AsyncSession) -> None:
    await set_rls_context(session, user_id=None, workspace_ids=[])
    await set_auth_lookup(session, enabled=False)
