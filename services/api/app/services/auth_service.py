"""Authentication service: register, login, verify, reset, logout."""

from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.email_tokens import hash_raw_token, issue_email_token, issue_password_reset_token
from app.auth.password import hash_password, needs_rehash, verify_password
from app.auth.rate_limits import check_auth_rate_limits
from app.auth.tokens import hash_token
from app.config import Settings
from app.db.rls import set_auth_lookup, set_rls_context
from app.errors import ConflictError, UnauthorizedError, ValidationAppError
from app.logging import get_logger
from app.models.enums import SecurityEventType, SessionStatus, UserStatus, WorkspaceRole
from app.models.identity import (
    AuthLoginChallenge,
    EmailVerificationToken,
    MfaMethod,
    PasswordResetToken,
)
from app.models.session import AuthSession
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories import UserRepository
from app.services.device_service import DeviceService
from app.services.email_service import EmailService
from app.services.security_events import SecurityEventService
from app.services.session_service import SessionService
from app.services.subscription_service import SubscriptionService

logger = get_logger(__name__)

GENERIC_AUTH_ERROR = "Invalid email or password"


@dataclass
class AuthTokens:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 900
    session_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None


@dataclass
class LoginResult:
    tokens: AuthTokens | None = None
    mfa_required: bool = False
    challenge_id: str | None = None


class AuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.db = session
        self.settings = settings
        self.users = UserRepository(session)
        self.sessions = SessionService(session, settings)
        self.devices = DeviceService(session)
        self.email = EmailService(settings)
        self.security = SecurityEventService(session)

    async def register(
        self,
        *,
        email: str,
        password: str,
        display_name: str,
        ip_address: str | None = None,
    ) -> User:
        check_auth_rate_limits(
            settings=self.settings, ip_address=ip_address, account_key=email
        )
        self._validate_password(password)
        normalized = email.strip().lower()
        if await self.users.get_by_email(normalized):
            raise ConflictError("An account with this email already exists")

        user = User(
            id=uuid.uuid4(),
            email=email.strip(),
            normalized_email=normalized,
            display_name=display_name.strip() or normalized.split("@")[0],
            status=UserStatus.PENDING_VERIFICATION.value,
            password_hash=hash_password(password),
        )
        self.db.add(user)
        await self.db.flush()
        await set_rls_context(self.db, user_id=user.id, workspace_ids=[])

        workspace = Workspace(
            id=uuid.uuid4(),
            name=f"{user.display_name}'s Workspace",
            type="personal",
            owner_id=user.id,
        )
        self.db.add(workspace)
        await self.db.flush()
        self.db.add(
            WorkspaceMember(
                id=uuid.uuid4(),
                workspace_id=workspace.id,
                user_id=user.id,
                role=WorkspaceRole.OWNER.value,
            )
        )
        await SubscriptionService(self.db).ensure_free_subscription(user.id)

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
        await self.email.send_verification(to=user.email, token=issued.raw)
        return user

    async def login(
        self,
        *,
        email: str,
        password: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        device_fingerprint: str | None = None,
        device_name: str | None = None,
        platform: str | None = None,
    ) -> LoginResult:
        check_auth_rate_limits(
            settings=self.settings, ip_address=ip_address, account_key=email
        )
        user = await self.users.get_by_email(email)
        if (
            user is None
            or not user.password_hash
            or user.status in (UserStatus.DISABLED.value, UserStatus.DELETED.value, UserStatus.SUSPENDED.value)
        ):
            await self.security.record(
                event_type=SecurityEventType.AUTHENTICATION_FAILED,
                message="Login failed",
                ip_address=ip_address,
                details={"email": email.strip().lower()},
            )
            raise UnauthorizedError(GENERIC_AUTH_ERROR)

        if not verify_password(user.password_hash, password):
            await self.security.record(
                event_type=SecurityEventType.AUTHENTICATION_FAILED,
                message="Login failed",
                actor_user_id=user.id,
                ip_address=ip_address,
            )
            raise UnauthorizedError(GENERIC_AUTH_ERROR)

        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(password)

        if await self._user_has_mfa(user.id):
            await set_rls_context(self.db, user_id=user.id, workspace_ids=[])
            challenge_raw = secrets.token_urlsafe(32)
            challenge = AuthLoginChallenge(
                id=uuid.uuid4(),
                user_id=user.id,
                challenge_hash=hash_token(challenge_raw),
                expires_at=datetime.now(UTC)
                + timedelta(seconds=self.settings.auth_challenge_ttl_seconds),
                ip_address=ip_address,
                user_agent=user_agent,
                device_fingerprint=device_fingerprint,
            )
            self.db.add(challenge)
            await self.db.flush()
            return LoginResult(mfa_required=True, challenge_id=str(challenge.id))

        tokens = await self._issue_login_tokens(
            user,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=device_fingerprint,
            device_name=device_name,
            platform=platform,
        )
        return LoginResult(tokens=tokens)

    async def complete_mfa_challenge(
        self,
        *,
        challenge_id: uuid.UUID,
        totp_code: str | None = None,
        recovery_code: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        device_name: str | None = None,
        platform: str | None = None,
    ) -> AuthTokens:
        from app.services.mfa_service import MfaService

        await set_auth_lookup(self.db, enabled=True)
        try:
            result = await self.db.execute(
                select(AuthLoginChallenge).where(AuthLoginChallenge.id == challenge_id)
            )
            challenge = result.scalar_one_or_none()
        finally:
            await set_auth_lookup(self.db, enabled=False)
        if (
            challenge is None
            or challenge.consumed_at is not None
            or challenge.expires_at < datetime.now(UTC)
        ):
            raise UnauthorizedError("Invalid or expired MFA challenge")

        await set_rls_context(self.db, user_id=challenge.user_id, workspace_ids=[])
        mfa = MfaService(self.db, self.settings)
        ok = False
        if totp_code:
            ok = await mfa.verify_totp(user_id=challenge.user_id, code=totp_code)
        elif recovery_code:
            ok = await mfa.consume_recovery_code(user_id=challenge.user_id, code=recovery_code)
        if not ok:
            await self.security.record(
                event_type=SecurityEventType.MFA_FAILED,
                message="MFA challenge failed",
                actor_user_id=challenge.user_id,
                ip_address=ip_address,
            )
            raise UnauthorizedError("Invalid MFA code")

        challenge.consumed_at = datetime.now(UTC)
        user = await self.users.get_by_id(challenge.user_id)
        assert user is not None
        return await self._issue_login_tokens(
            user,
            ip_address=ip_address or challenge.ip_address,
            user_agent=user_agent or challenge.user_agent,
            device_fingerprint=challenge.device_fingerprint,
            device_name=device_name,
            platform=platform,
        )

    async def logout(self, *, session_id: uuid.UUID, user_id: uuid.UUID) -> None:
        await self.sessions.revoke_session(session_id, user_id=user_id, reason="logout")

    async def refresh(
        self,
        *,
        refresh_token: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuthTokens:
        auth_session, access, raw_refresh = await self.sessions.rotate_refresh(
            refresh_token=refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return AuthTokens(
            access_token=access,
            refresh_token=raw_refresh,
            expires_in=self.settings.access_token_ttl_seconds,
            session_id=auth_session.id,
            user_id=auth_session.user_id,
        )

    async def verify_email(self, *, token: str) -> User:
        token_hash = hash_raw_token(token)
        await set_auth_lookup(self.db, enabled=True)
        try:
            result = await self.db.execute(
                select(EmailVerificationToken).where(
                    EmailVerificationToken.token_hash == token_hash
                )
            )
            row = result.scalar_one_or_none()
        finally:
            await set_auth_lookup(self.db, enabled=False)
        if row is None or row.used_at is not None or row.expires_at < datetime.now(UTC):
            raise ValidationAppError("Invalid or expired verification token")
        await set_rls_context(self.db, user_id=row.user_id, workspace_ids=[])
        user = await self.users.get_by_id(row.user_id)
        if user is None:
            raise ValidationAppError("Invalid or expired verification token")
        row.used_at = datetime.now(UTC)
        user.email_verified_at = datetime.now(UTC)
        if user.status == UserStatus.PENDING_VERIFICATION.value:
            user.status = UserStatus.ACTIVE.value
        await self.db.flush()
        return user

    async def resend_verification(self, *, email: str, ip_address: str | None = None) -> None:
        check_auth_rate_limits(
            settings=self.settings, ip_address=ip_address, account_key=email
        )
        user = await self.users.get_by_email(email)
        # Always return success externally
        if user is None or user.email_verified_at is not None:
            return
        await set_rls_context(self.db, user_id=user.id, workspace_ids=[])
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
        await self.email.send_verification(to=user.email, token=issued.raw)

    async def request_password_reset(
        self, *, email: str, ip_address: str | None = None
    ) -> None:
        check_auth_rate_limits(
            settings=self.settings, ip_address=ip_address, account_key=email
        )
        user = await self.users.get_by_email(email)
        await self.security.record(
            event_type=SecurityEventType.PASSWORD_RESET_REQUESTED,
            message="Password reset requested",
            actor_user_id=user.id if user else None,
            ip_address=ip_address,
        )
        if user is None or not user.password_hash:
            return
        await set_rls_context(self.db, user_id=user.id, workspace_ids=[])
        issued = issue_password_reset_token(
            ttl_seconds=self.settings.password_reset_ttl_seconds
        )
        self.db.add(
            PasswordResetToken(
                id=uuid.uuid4(),
                user_id=user.id,
                token_hash=issued.token_hash,
                expires_at=issued.expires_at,
            )
        )
        await self.db.flush()
        await self.email.send_password_reset(to=user.email, token=issued.raw)

    async def reset_password(self, *, token: str, new_password: str) -> None:
        self._validate_password(new_password)
        token_hash = hash_raw_token(token)
        await set_auth_lookup(self.db, enabled=True)
        try:
            result = await self.db.execute(
                select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
            )
            row = result.scalar_one_or_none()
        finally:
            await set_auth_lookup(self.db, enabled=False)
        if row is None or row.used_at is not None or row.expires_at < datetime.now(UTC):
            raise ValidationAppError("Invalid or expired reset token")
        await set_rls_context(self.db, user_id=row.user_id, workspace_ids=[])
        user = await self.users.get_by_id(row.user_id)
        if user is None:
            raise ValidationAppError("Invalid or expired reset token")
        row.used_at = datetime.now(UTC)
        user.password_hash = hash_password(new_password)
        # Revoke all sessions
        for s in await self.sessions.list_for_user(user.id):
            if s.status == SessionStatus.ACTIVE.value:
                await self.sessions.revoke_session(
                    s.id, user_id=user.id, reason="password_reset"
                )
        await self.db.flush()

    async def get_session_info(self, session_id: uuid.UUID) -> AuthSession | None:
        return await self.sessions.get_active(session_id)

    async def _issue_login_tokens(
        self,
        user: User,
        *,
        ip_address: str | None,
        user_agent: str | None,
        device_fingerprint: str | None,
        device_name: str | None,
        platform: str | None,
    ) -> AuthTokens:
        device_id = None
        if device_fingerprint:
            device = await self.devices.upsert(
                user_id=user.id,
                fingerprint=device_fingerprint,
                name=device_name or "Unknown device",
                platform=platform,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            device_id = device.id

        auth_session, access, raw_refresh = await self.sessions.create_session(
            user_id=user.id,
            device_id=device_id,
            ip_address=ip_address,
            user_agent=user_agent,
            created_from="password",
        )
        user.last_login_at = datetime.now(UTC)
        await self.db.flush()
        return AuthTokens(
            access_token=access,
            refresh_token=raw_refresh,
            expires_in=self.settings.access_token_ttl_seconds,
            session_id=auth_session.id,
            user_id=user.id,
        )

    async def _user_has_mfa(self, user_id: uuid.UUID) -> bool:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        result = await self.db.execute(
            select(MfaMethod).where(
                MfaMethod.user_id == user_id,
                MfaMethod.verified.is_(True),
            )
        )
        return result.scalar_one_or_none() is not None

    @staticmethod
    def _validate_password(password: str) -> None:
        if len(password) < 10:
            raise ValidationAppError("Password must be at least 10 characters")
