"""Password reset flow."""

from __future__ import annotations

import uuid

import re

import pytest
from httpx import AsyncClient

from app.services.email_service import get_console_outbox


@pytest.mark.asyncio
async def test_password_reset_flow(app_client: AsyncClient) -> None:
    email = f"resetme-{uuid.uuid4().hex[:10]}@example.com"
    password = "secure-password-1"
    await app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "Reset"},
    )
    req = await app_client.post(
        "/api/v1/auth/request-password-reset",
        json={"email": email},
    )
    assert req.status_code == 200
    outbox = get_console_outbox()
    assert outbox
    match = re.search(r"token=([A-Za-z0-9_-]+)", outbox[-1].body_text)
    assert match
    token = match.group(1)

    new_password = "brand-new-password"
    reset = await app_client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": new_password},
    )
    assert reset.status_code == 200, reset.text

    old = await app_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert old.status_code == 401

    ok = await app_client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": new_password},
    )
    assert ok.status_code == 200
