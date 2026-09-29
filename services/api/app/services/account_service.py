"""Account profile and lifecycle operations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.email_tokens import issue_email_token
from app.auth.password import hash_password, verify_password
from app.config import Settings
from app.errors import ConflictError, ValidationAppError
from app.models.enums import SessionStatus, UserStatus
from app.models.identity import EmailVerificationToken
from app.models.user import User
from app.repositories import UserRepository
from app.services.email_service import EmailService
from app.services.session_service import SessionService


class AccountService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.db = session
        self.settings = settings
        self.users = UserRepository(session)
        self.sessions = SessionService(session, settings)
        self.email = EmailService(settings)

    async def get(self, user_id: uuid.UUID) -> User:
        user = await self.users.get_by_id(user_id)
        assert user is not None
        return user

    async def patch(
        self,
        user_id: uuid.UUID,
        *,
        display_name: str | None = None,
    ) -> User:
        user = await self.get(user_id)
        if display_name is not None:
            user.display_name = display_name.strip()
        await self.db.flush()
        return user

    async def change_password(
        self,
        user_id: uuid.UUID,
        *,
        current_password: str,
        new_password: str,
    ) -> None:
        if len(new_password) < 10:
            raise ValidationAppError("Password must be at least 10 characters")
        user = await self.get(user_id)
        if not user.password_hash or not verify_password(user.password_hash, current_password):
            raise ValidationAppError("Current password is incorrect")
        user.password_hash = hash_password(new_password)
        for s in await self.sessions.list_for_user(user_id):
            if s.status == SessionStatus.ACTIVE.value:
                # Keep current session; revoke others via caller if needed
                pass
        await self.db.flush()

    async def request_email_change(self, user_id: uuid.UUID, *, new_email: str) -> None:
        normalized = new_email.strip().lower()
        existing = await self.users.get_by_email(normalized)
        if existing and existing.id != user_id:
            raise ConflictError("Email already in use")
        user = await self.get(user_id)
        issued = issue_email_token(ttl_seconds=self.settings.email_verification_ttl_seconds)
        self.db.add(
            EmailVerificationToken(
                id=uuid.uuid4(),
                user_id=user.id,
                token_hash=issued.token_hash,
                expires_at=issued.expires_at,
            )
        )
        await self.db.flush()
        await self.email.send_email_change(to=normalized, token=issued.raw)

    async def deactivate(self, user_id: uuid.UUID) -> User:
        user = await self.get(user_id)
        user.status = UserStatus.DISABLED.value
        for s in await self.sessions.list_for_user(user_id):
            if s.status == SessionStatus.ACTIVE.value:
                await self.sessions.revoke_session(
                    s.id, user_id=user_id, reason="deactivate"
                )
        await self.db.flush()
        return user

    async def request_delete(self, user_id: uuid.UUID) -> User:
        user = await self.get(user_id)
        user.status = UserStatus.DELETED.value
        # Soft-delete marker; hard purge is a later ops job
        for s in await self.sessions.list_for_user(user_id):
            if s.status == SessionStatus.ACTIVE.value:
                await self.sessions.revoke_session(
                    s.id, user_id=user_id, reason="account_delete"
                )
        await self.db.flush()
        return user
