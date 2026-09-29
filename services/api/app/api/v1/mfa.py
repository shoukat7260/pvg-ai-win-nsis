"""MFA endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUserDep, DbSessionDep, SettingsDep
from app.repositories import UserRepository
from app.schemas.auth import (
    MfaDisableRequest,
    MfaRecoveryRegenerateRequest,
    MfaSetupResponse,
    MfaVerifyEnableRequest,
)
from app.schemas.common import MessageResponse
from app.services.mfa_service import MfaService
from pydantic import BaseModel

router = APIRouter(prefix="/mfa", tags=["mfa"])


class RecoveryCodesResponse(BaseModel):
    recovery_codes: list[str]


@router.post("/setup", response_model=MfaSetupResponse)
async def setup_mfa(
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MfaSetupResponse:
    data = await MfaService(session, settings).setup_totp(
        user_id=user.id, account_email=user.email
    )
    return MfaSetupResponse(**data)


@router.post("/verify-enable", response_model=RecoveryCodesResponse)
async def verify_enable(
    body: MfaVerifyEnableRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> RecoveryCodesResponse:
    codes = await MfaService(session, settings).verify_enable(
        user_id=user.id, code=body.code
    )
    return RecoveryCodesResponse(recovery_codes=codes)


@router.post("/disable", response_model=MessageResponse)
async def disable_mfa(
    body: MfaDisableRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> MessageResponse:
    db_user = await UserRepository(session).get_by_id(user.id)
    assert db_user is not None and db_user.password_hash
    await MfaService(session, settings).disable(
        user_id=user.id,
        password_hash_check=db_user.password_hash,
        password=body.password,
    )
    return MessageResponse(message="MFA disabled")


@router.post("/recovery/regenerate", response_model=RecoveryCodesResponse)
async def regenerate_recovery(
    body: MfaRecoveryRegenerateRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> RecoveryCodesResponse:
    codes = await MfaService(session, settings).regenerate_recovery_codes(
        user_id=user.id, totp_code=body.totp_code
    )
    return RecoveryCodesResponse(recovery_codes=codes)
