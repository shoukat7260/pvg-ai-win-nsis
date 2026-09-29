"""Google OAuth / OIDC helpers (web + desktop PKCE)."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.tokens import hash_token
from app.config import Settings
from app.db.rls import set_auth_lookup, set_rls_context
from app.errors import UnauthorizedError, ValidationAppError
from app.logging import get_logger
from app.models.enums import SecurityEventType, UserStatus, WorkspaceRole
from app.models.identity import DesktopAuthCode, OAuthIdentity
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.repositories import UserRepository
from app.services.security_events import SecurityEventService
from app.services.session_service import SessionService
from app.services.subscription_service import SubscriptionService

logger = get_logger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


@dataclass
class OAuthState:
    state: str
    code_verifier: str | None = None


class GoogleOAuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.db = session
        self.settings = settings
        self.users = UserRepository(session)
        self.sessions = SessionService(session, settings)
        self.security = SecurityEventService(session)

    def is_configured(self) -> bool:
        return bool(
            self.settings.google_oauth_client_id
            and self.settings.google_oauth_client_secret
            and self.settings.google_oauth_redirect_uri
        )

    def build_authorize_url(
        self,
        *,
        state: str,
        code_challenge: str | None = None,
        redirect_uri: str | None = None,
    ) -> str:
        if not self.settings.google_oauth_client_id:
            raise ValidationAppError("Google OAuth is not configured")
        params: dict[str, str] = {
            "client_id": self.settings.google_oauth_client_id,
            "redirect_uri": redirect_uri or self.settings.google_oauth_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    @staticmethod
    def new_state() -> str:
        return secrets.token_urlsafe(32)

    @staticmethod
    def pkce_pair() -> tuple[str, str]:
        verifier = secrets.token_urlsafe(64)
        challenge = (
            hashlib.sha256(verifier.encode("ascii")).digest()
        )
        import base64

        challenge_b64 = base64.urlsafe_b64encode(challenge).decode("ascii").rstrip("=")
        return verifier, challenge_b64

    async def handle_callback(
        self,
        *,
        code: str,
        state: str,
        expected_state: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> tuple[User, str, str, uuid.UUID]:
        if not secrets.compare_digest(state, expected_state):
            await self.security.record(
                event_type=SecurityEventType.OAUTH_STATE_MISMATCH,
                message="OAuth state mismatch",
                severity="critical",
                ip_address=ip_address,
            )
            raise UnauthorizedError("Invalid OAuth state")

        if not self.is_configured():
            raise ValidationAppError("Google OAuth is not configured")

        token_data = await self._exchange_code(code)
        access = token_data.get("access_token")
        if not access:
            raise UnauthorizedError("OAuth token exchange failed")
        profile = await self._fetch_userinfo(str(access))
        subject = str(profile.get("sub") or "")
        email = str(profile.get("email") or "").strip().lower()
        if not subject or not email:
            raise UnauthorizedError("OAuth profile incomplete")

        user = await self._get_or_create_user(subject=subject, email=email, profile=profile)
        auth_session, access_token, refresh = await self.sessions.create_session(
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            created_from="oauth_google",
        )
        return user, access_token, refresh, auth_session.id

    async def _exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self.settings.google_oauth_client_id,
                    "client_secret": self.settings.google_oauth_client_secret,
                    "redirect_uri": self.settings.google_oauth_redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if resp.status_code >= 400:
                logger.warning("oauth_token_exchange_failed", status=resp.status_code)
                raise UnauthorizedError("OAuth token exchange failed")
            return resp.json()

    async def _fetch_userinfo(self, access_token: str) -> dict:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code >= 400:
                raise UnauthorizedError("OAuth userinfo failed")
            return resp.json()

    async def _get_or_create_user(
        self, *, subject: str, email: str, profile: dict
    ) -> User:
        result = await self.db.execute(
            select(OAuthIdentity).where(
                OAuthIdentity.provider == "google",
                OAuthIdentity.provider_subject == subject,
            )
        )
        identity = result.scalar_one_or_none()
        if identity:
            user = await self.users.get_by_id(identity.user_id)
            if user is None:
                raise UnauthorizedError("OAuth identity orphaned")
            return user

        user = await self.users.get_by_email(email)
        if user is None:
            user = User(
                id=uuid.uuid4(),
                email=email,
                normalized_email=email,
                display_name=str(profile.get("name") or email.split("@")[0]),
                status=UserStatus.ACTIVE.value,
                email_verified_at=datetime.now(UTC),
                password_hash=None,
            )
            self.db.add(user)
            await self.db.flush()
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

        self.db.add(
            OAuthIdentity(
                id=uuid.uuid4(),
                provider="google",
                provider_subject=subject,
                user_id=user.id,
                email=email,
            )
        )
        await self.db.flush()
        return user


class DesktopAuthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.db = session
        self.settings = settings
        self.sessions = SessionService(session, settings)

    async def start(
        self,
        *,
        code_challenge: str,
        code_challenge_method: str = "S256",
        redirect_uri: str | None = None,
        state: str | None = None,
    ) -> dict:
        if code_challenge_method != "S256":
            raise ValidationAppError("Only S256 PKCE is supported")
        await set_auth_lookup(self.db, enabled=True)
        state_raw = state or secrets.token_urlsafe(24)
        # Placeholder code until browser completes login
        pending_code = secrets.token_urlsafe(32)
        row = DesktopAuthCode(
            id=uuid.uuid4(),
            code_hash=hash_token(pending_code),
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            state_hash=hash_token(state_raw),
            redirect_uri=redirect_uri or self.settings.desktop_auth_redirect,
            expires_at=datetime.now(UTC)
            + timedelta(seconds=self.settings.desktop_auth_code_ttl_seconds),
            status="pending",
        )
        self.db.add(row)
        await self.db.flush()
        return {
            "auth_request_id": str(row.id),
            "state": state_raw,
            "pending_code": pending_code,
            "authorize_path": f"/api/v1/auth/desktop/complete?auth_request_id={row.id}",
            "expires_at": row.expires_at.isoformat(),
        }

    async def complete_for_user(
        self,
        *,
        auth_request_id: uuid.UUID,
        user_id: uuid.UUID,
        state: str,
    ) -> dict:
        await set_auth_lookup(self.db, enabled=True)
        row = await self._get(auth_request_id)
        if row.status != "pending" or row.expires_at < datetime.now(UTC):
            raise ValidationAppError("Auth request expired")
        if not secrets.compare_digest(hash_token(state), row.state_hash):
            raise UnauthorizedError("Invalid state")
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        auth_session, access, refresh = await self.sessions.create_session(
            user_id=user_id,
            created_from="desktop_browser",
        )
        # Issue a new single-use exchange code
        exchange_code = secrets.token_urlsafe(32)
        row.code_hash = hash_token(exchange_code)
        row.user_id = user_id
        row.session_id = auth_session.id
        row.status = "ready"
        await self.db.flush()
        return {
            "code": exchange_code,
            "redirect_uri": row.redirect_uri,
            "access_token": access,
            "refresh_token": refresh,
            "session_id": str(auth_session.id),
        }

    async def exchange(
        self,
        *,
        code: str,
        code_verifier: str,
        state: str,
    ) -> dict:
        code_hash = hash_token(code)
        await set_auth_lookup(self.db, enabled=True)
        try:
            result = await self.db.execute(
                select(DesktopAuthCode).where(DesktopAuthCode.code_hash == code_hash)
            )
            row = result.scalar_one_or_none()
        finally:
            await set_auth_lookup(self.db, enabled=False)
        if (
            row is None
            or row.consumed_at is not None
            or row.status != "ready"
            or row.expires_at < datetime.now(UTC)
            or row.user_id is None
            or row.session_id is None
        ):
            raise UnauthorizedError("Invalid desktop auth code")
        if not secrets.compare_digest(hash_token(state), row.state_hash):
            raise UnauthorizedError("Invalid state")
        expected_challenge = (
            __import__("base64")
            .urlsafe_b64encode(hashlib.sha256(code_verifier.encode("ascii")).digest())
            .decode("ascii")
            .rstrip("=")
        )
        if not secrets.compare_digest(expected_challenge, row.code_challenge):
            raise UnauthorizedError("PKCE verification failed")

        await set_rls_context(self.db, user_id=row.user_id, workspace_ids=[])
        row.consumed_at = datetime.now(UTC)
        row.status = "consumed"
        # Re-issue tokens for the bound session user
        auth_session, access, refresh = await self.sessions.create_session(
            user_id=row.user_id,
            created_from="desktop_pkce",
        )
        await self.db.flush()
        return {
            "access_token": access,
            "refresh_token": refresh,
            "token_type": "bearer",
            "expires_in": self.settings.access_token_ttl_seconds,
            "session_id": str(auth_session.id),
            "user_id": str(row.user_id),
        }

    async def poll(self, *, auth_request_id: uuid.UUID) -> dict:
        await set_auth_lookup(self.db, enabled=True)
        try:
            row = await self._get(auth_request_id)
        finally:
            await set_auth_lookup(self.db, enabled=False)
        return {
            "status": row.status,
            "expires_at": row.expires_at.isoformat(),
        }

    async def _get(self, auth_request_id: uuid.UUID) -> DesktopAuthCode:
        result = await self.db.execute(
            select(DesktopAuthCode).where(DesktopAuthCode.id == auth_request_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise ValidationAppError("Unknown auth request")
        return row
