"""Auth-related request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    device_fingerprint: str | None = None
    device_name: str | None = None
    platform: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    session_id: UUID | None = None
    user_id: UUID | None = None


class LoginResponse(BaseModel):
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in: int | None = None
    session_id: UUID | None = None
    user_id: UUID | None = None
    mfa_required: bool = False
    challenge_id: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=10, max_length=128)


class MfaSetupResponse(BaseModel):
    method_id: str
    secret: str
    provisioning_uri: str


class MfaVerifyEnableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class MfaDisableRequest(BaseModel):
    password: str


class MfaRecoveryRegenerateRequest(BaseModel):
    totp_code: str = Field(min_length=6, max_length=8)


class MfaChallengeVerifyRequest(BaseModel):
    challenge_id: UUID
    totp_code: str | None = None
    recovery_code: str | None = None
    device_fingerprint: str | None = None
    device_name: str | None = None
    platform: str | None = None


class SessionRead(BaseModel):
    id: UUID
    status: str
    created_at: datetime
    last_seen_at: datetime | None
    ip_address: str | None
    user_agent: str | None
    created_from: str | None
    device_id: UUID | None

    model_config = {"from_attributes": True}


class DeviceRead(BaseModel):
    id: UUID
    device_public_id: str
    name: str
    platform: str | None
    os_version: str | None
    app_version: str | None
    architecture: str | None
    trusted: bool
    status: str
    last_seen_at: datetime | None
    last_ip: str | None

    model_config = {"from_attributes": True}


class DeviceRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class AccountPatchRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


class EmailChangeRequest(BaseModel):
    new_email: EmailStr


class CsrfResponse(BaseModel):
    csrf_token: str
