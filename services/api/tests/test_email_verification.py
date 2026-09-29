"""Email verification flow."""

from __future__ import annotations

import uuid

import re

import pytest
from httpx import AsyncClient

from app.services.email_service import get_console_outbox


@pytest.mark.asyncio
async def test_email_verification(app_client: AsyncClient) -> None:
    email = f"verify-{uuid.uuid4().hex[:10]}@example.com"
    await app_client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secure-password-1", "display_name": "Verify"},
    )
    outbox = get_console_outbox()
    assert outbox
    match = re.search(r"token=([A-Za-z0-9_-]+)", outbox[-1].body_text)
    assert match
    token = match.group(1)

    resp = await app_client.post("/api/v1/auth/verify-email", json={"token": token})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "active"
    assert resp.json()["email_verified_at"] is not None

    # single-use
    again = await app_client.post("/api/v1/auth/verify-email", json={"token": token})
    assert again.status_code == 422
