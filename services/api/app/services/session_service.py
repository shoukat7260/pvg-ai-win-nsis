"""Session lifecycle: issue, rotate, revoke, reuse detection."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import create_access_token, create_refresh_token, hash_token
from app.config import Settings, get_settings
from app.db.rls import set_auth_lookup, set_rls_context
from app.errors import UnauthorizedError
from app.logging import get_logger
from app.models.enums import SecurityEventType, SessionStatus
from app.models.session import AuthSession
from app.services.security_events import SecurityEventService

logger = get_logger(__name__)


async def _commit_family_revocation(
    *,
    family_id: uuid.UUID,
    reason: str,
    actor_user_id: uuid.UUID | None,
    ip_address: str | None,
) -> None:
    """Persist family revocation on a dedicated admin connection (survives request rollback)."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    settings = get_settings()
    engine = create_async_engine(settings.database_admin_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with factory() as session:
            now = datetime.now(UTC)
            await session.execute(
                update(AuthSession)
                .where(
                    AuthSession.family_id == family_id,
                    AuthSession.status == SessionStatus.ACTIVE.value,
                )
                .values(
                    status=SessionStatus.REVOKED.value,
                    revoked_at=now,
                    revoke_reason=reason,
                    refresh_token_hash=None,
                )
            )
            await SecurityEventService(session).record(
                event_type=SecurityEventType.REFRESH_REUSE_DETECTED,
                message="Refresh token reuse detected; family revoked",
                severity="critical",
                actor_user_id=actor_user_id,
                ip_address=ip_address,
                details={"family_id": str(family_id), "reason": reason},
            )
            await session.commit()
    finally:
        await engine.dispose()
    logger.warning("refresh_reuse_detected", family_id=str(family_id))


class SessionService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.db = session
        self.settings = settings

    async def create_session(
        self,
        *,
        user_id: uuid.UUID,
        device_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        created_from: str = "password",
        family_id: uuid.UUID | None = None,
    ) -> tuple[AuthSession, str, str]:
        """Create session; returns (session, access_token, refresh_token_raw)."""
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        raw_refresh, refresh_hash = create_refresh_token()
        now = datetime.now(UTC)
        family = family_id or uuid.uuid4()
        auth_session = AuthSession(
            id=uuid.uuid4(),
            user_id=user_id,
            device_id=device_id,
            family_id=family,
            refresh_token_hash=refresh_hash,
            status=SessionStatus.ACTIVE.value,
            expires_at=now + timedelta(seconds=self.settings.refresh_token_ttl_seconds),
            last_seen_at=now,
            created_from=created_from,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        access, claims = create_access_token(
            user_id=user_id,
            session_id=auth_session.id,
            settings=self.settings,
        )
        auth_session.access_jti = claims.jti
        self.db.add(auth_session)
        await self.db.flush()
        return auth_session, access, raw_refresh

    async def rotate_refresh(
        self,
        *,
        refresh_token: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[AuthSession, str, str]:
        token_hash = hash_token(refresh_token)
        await set_auth_lookup(self.db, enabled=True)
        try:
            result = await self.db.execute(
                select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
            )
            current = result.scalar_one_or_none()
        finally:
            await set_auth_lookup(self.db, enabled=False)

        if current is None:
            raise UnauthorizedError("Invalid refresh token")

        await set_rls_context(self.db, user_id=current.user_id, workspace_ids=[])

        # Reuse detection: presenting a rotated/revoked family's prior refresh invalidates all
        if current.status != SessionStatus.ACTIVE.value:
            await _commit_family_revocation(
                family_id=current.family_id,
                reason="refresh_reuse",
                actor_user_id=current.user_id,
                ip_address=ip_address,
            )
            raise UnauthorizedError("Refresh token reuse detected")

        if current.expires_at and current.expires_at < datetime.now(UTC):
            current.status = SessionStatus.EXPIRED.value
            current.revoked_at = datetime.now(UTC)
            current.revoke_reason = "expired"
            await self.db.flush()
            raise UnauthorizedError("Refresh token expired")

        # Rotate: mark current revoked but KEEP hash so reuse can be detected
        now = datetime.now(UTC)
        current.status = SessionStatus.REVOKED.value
        current.revoked_at = now
        current.revoke_reason = "rotated"

        return await self.create_session(
            user_id=current.user_id,
            device_id=current.device_id,
            ip_address=ip_address or current.ip_address,
            user_agent=user_agent or current.user_agent,
            created_from=current.created_from or "refresh",
            family_id=current.family_id,
        )

    async def _invalidate_family(
        self,
        family_id: uuid.UUID,
        *,
        reason: str,
        actor_user_id: uuid.UUID | None,
        ip_address: str | None,
    ) -> None:
        now = datetime.now(UTC)
        await self.db.execute(
            update(AuthSession)
            .where(
                AuthSession.family_id == family_id,
                AuthSession.status == SessionStatus.ACTIVE.value,
            )
            .values(
                status=SessionStatus.REVOKED.value,
                revoked_at=now,
                revoke_reason=reason,
                refresh_token_hash=None,
            )
        )
        await SecurityEventService(self.db).record(
            event_type=SecurityEventType.REFRESH_REUSE_DETECTED,
            message="Refresh token reuse detected; family revoked",
            severity="critical",
            actor_user_id=actor_user_id,
            ip_address=ip_address,
            details={"family_id": str(family_id), "reason": reason},
        )
        logger.warning("refresh_reuse_detected", family_id=str(family_id))

    async def revoke_session(
        self,
        session_id: uuid.UUID,
        *,
        user_id: uuid.UUID,
        reason: str = "user_logout",
    ) -> None:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        result = await self.db.execute(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.user_id == user_id,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            return
        row.status = SessionStatus.REVOKED.value
        row.revoked_at = datetime.now(UTC)
        row.revoke_reason = reason
        row.refresh_token_hash = None
        await self.db.flush()

    async def revoke_others(
        self,
        *,
        user_id: uuid.UUID,
        keep_session_id: uuid.UUID,
        reason: str = "revoke_others",
    ) -> int:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        now = datetime.now(UTC)
        result = await self.db.execute(
            update(AuthSession)
            .where(
                AuthSession.user_id == user_id,
                AuthSession.id != keep_session_id,
                AuthSession.status == SessionStatus.ACTIVE.value,
            )
            .values(
                status=SessionStatus.REVOKED.value,
                revoked_at=now,
                revoke_reason=reason,
                refresh_token_hash=None,
            )
        )
        return result.rowcount or 0

    async def list_for_user(self, user_id: uuid.UUID) -> list[AuthSession]:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        result = await self.db.execute(
            select(AuthSession)
            .where(AuthSession.user_id == user_id)
            .order_by(AuthSession.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_active(self, session_id: uuid.UUID) -> AuthSession | None:
        await set_auth_lookup(self.db, enabled=True)
        try:
            result = await self.db.execute(
                select(AuthSession).where(
                    AuthSession.id == session_id,
                    AuthSession.status == SessionStatus.ACTIVE.value,
                )
            )
            return result.scalar_one_or_none()
        finally:
            await set_auth_lookup(self.db, enabled=False)

    async def touch(self, session_id: uuid.UUID) -> None:
        await set_auth_lookup(self.db, enabled=True)
        try:
            await self.db.execute(
                update(AuthSession)
                .where(AuthSession.id == session_id)
                .values(last_seen_at=datetime.now(UTC))
            )
        finally:
            await set_auth_lookup(self.db, enabled=False)
