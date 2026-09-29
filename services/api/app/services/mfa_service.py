"""TOTP MFA and recovery codes."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.password import hash_password, verify_password
from app.config import Settings
from app.db.rls import set_rls_context
from app.errors import ConflictError, NotFoundError, ValidationAppError
from app.models.enums import MfaMethodType
from app.models.identity import MfaMethod, MfaRecoveryCode
from app.services.crypto_secrets import decrypt_secret, encrypt_secret


class MfaService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.db = session
        self.settings = settings

    async def setup_totp(self, *, user_id: uuid.UUID, account_email: str) -> dict:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        existing = await self._get_verified(user_id)
        if existing:
            raise ConflictError("MFA is already enabled")

        # Remove any unverified pending method
        result = await self.db.execute(
            select(MfaMethod).where(
                MfaMethod.user_id == user_id,
                MfaMethod.verified.is_(False),
            )
        )
        for pending in result.scalars().all():
            await self.db.delete(pending)

        secret = pyotp.random_base32()
        method = MfaMethod(
            id=uuid.uuid4(),
            user_id=user_id,
            type=MfaMethodType.TOTP.value,
            secret_encrypted=encrypt_secret(secret, self.settings),
            verified=False,
        )
        self.db.add(method)
        await self.db.flush()
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=account_email, issuer_name="PVG AI")
        return {
            "method_id": str(method.id),
            "secret": secret,
            "provisioning_uri": provisioning_uri,
        }

    async def verify_enable(self, *, user_id: uuid.UUID, code: str) -> list[str]:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        result = await self.db.execute(
            select(MfaMethod).where(
                MfaMethod.user_id == user_id,
                MfaMethod.verified.is_(False),
                MfaMethod.type == MfaMethodType.TOTP.value,
            )
        )
        method = result.scalar_one_or_none()
        if method is None:
            raise NotFoundError("No MFA setup in progress")
        secret = decrypt_secret(method.secret_encrypted, self.settings)
        if not pyotp.TOTP(secret).verify(code, valid_window=1):
            raise ValidationAppError("Invalid TOTP code")
        method.verified = True
        method.enabled_at = datetime.now(UTC)
        recovery_codes = await self._regenerate_recovery_codes(user_id)
        await self.db.flush()
        return recovery_codes

    async def disable(self, *, user_id: uuid.UUID, password_hash_check: str, password: str) -> None:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        if not verify_password(password_hash_check, password):
            raise ValidationAppError("Invalid password")
        result = await self.db.execute(select(MfaMethod).where(MfaMethod.user_id == user_id))
        for method in result.scalars().all():
            await self.db.delete(method)
        codes = await self.db.execute(
            select(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user_id)
        )
        for code in codes.scalars().all():
            await self.db.delete(code)
        await self.db.flush()

    async def regenerate_recovery_codes(
        self, *, user_id: uuid.UUID, totp_code: str
    ) -> list[str]:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        if not await self.verify_totp(user_id=user_id, code=totp_code):
            raise ValidationAppError("Invalid TOTP code")
        return await self._regenerate_recovery_codes(user_id)

    async def verify_totp(self, *, user_id: uuid.UUID, code: str) -> bool:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        method = await self._get_verified(user_id)
        if method is None:
            return False
        secret = decrypt_secret(method.secret_encrypted, self.settings)
        return bool(pyotp.TOTP(secret).verify(code, valid_window=1))

    async def consume_recovery_code(self, *, user_id: uuid.UUID, code: str) -> bool:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        result = await self.db.execute(
            select(MfaRecoveryCode).where(
                MfaRecoveryCode.user_id == user_id,
                MfaRecoveryCode.used_at.is_(None),
            )
        )
        for row in result.scalars().all():
            if verify_password(row.code_hash, code.strip().upper()):
                row.used_at = datetime.now(UTC)
                await self.db.flush()
                return True
        return False

    async def _get_verified(self, user_id: uuid.UUID) -> MfaMethod | None:
        result = await self.db.execute(
            select(MfaMethod).where(
                MfaMethod.user_id == user_id,
                MfaMethod.verified.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def _regenerate_recovery_codes(self, user_id: uuid.UUID) -> list[str]:
        existing = await self.db.execute(
            select(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user_id)
        )
        for row in existing.scalars().all():
            await self.db.delete(row)
        codes: list[str] = []
        for _ in range(10):
            raw = secrets.token_hex(4).upper()
            codes.append(raw)
            self.db.add(
                MfaRecoveryCode(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    code_hash=hash_password(raw),
                )
            )
        await self.db.flush()
        return codes
