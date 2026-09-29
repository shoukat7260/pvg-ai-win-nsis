"""MFA setup and login challenge."""

from __future__ import annotations

import uuid

import pyotp
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_mfa_enable_and_login_challenge(app_client: AsyncClient) -> None:
    email = f"mfa-{uuid.uuid4().hex[:10]}@example.com"
    password = "secure-password-1"
    await app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "MFA"},
    )
    login = await app_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    access = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {access}"}

    setup = await app_client.post("/api/v1/mfa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    code = pyotp.TOTP(secret).now()

    enable = await app_client.post(
        "/api/v1/mfa/verify-enable",
        headers=headers,
        json={"code": code},
    )
    assert enable.status_code == 200, enable.text
    assert len(enable.json()["recovery_codes"]) == 10

    challenge_login = await app_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert challenge_login.status_code == 200
    body = challenge_login.json()
    assert body["mfa_required"] is True
    assert body["challenge_id"]
    assert body.get("access_token") in (None, "")

    totp = pyotp.TOTP(secret).now()
    verified = await app_client.post(
        "/api/v1/auth/mfa/challenge/verify",
        json={"challenge_id": body["challenge_id"], "totp_code": totp},
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["access_token"]
