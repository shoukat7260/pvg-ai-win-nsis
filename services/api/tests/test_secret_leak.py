"""Ensure secrets never appear in logs or structured error payloads."""

from __future__ import annotations

import io
import logging

import pytest
import structlog

from app.errors import error_body
from app.logging import configure_logging
from app.security.redaction import REDACTED, redact_mapping
from app.services.audit import AuditService


TEST_SECRET = "TEST_SECRET_123"


def test_error_body_redacts_details() -> None:
    body = error_body(
        code="validation_error",
        message="fail",
        request_id="req-1",
        details={"password": TEST_SECRET, "api_key": TEST_SECRET, "ok": "yes"},
    )
    serialized = str(body)
    assert TEST_SECRET not in serialized
    assert body["error"]["details"]["password"] == REDACTED
    assert body["error"]["details"]["api_key"] == REDACTED
    assert body["error"]["details"]["ok"] == "yes"


def test_structlog_output_redacts_secrets(caplog: pytest.LogCaptureFixture) -> None:
    configure_logging("INFO")
    log = structlog.get_logger("secret_leak_test")
    with caplog.at_level(logging.INFO):
        log.info("attempt", password=TEST_SECRET, token=TEST_SECRET, user="alice")
    combined = " ".join(r.message for r in caplog.records) + caplog.text
    assert TEST_SECRET not in combined
    assert "alice" in combined or REDACTED in combined


def test_audit_metadata_redaction_unit() -> None:
    data = redact_mapping({"authorization": f"Bearer {TEST_SECRET}", "action": "login"})
    assert data["authorization"] == REDACTED
    assert TEST_SECRET not in str(data)


@pytest.mark.asyncio
async def test_security_event_details_redacted(admin_session) -> None:
    from app.models.enums import SecurityEventType
    from app.services.security_events import SecurityEventService

    event = await SecurityEventService(admin_session).record(
        event_type=SecurityEventType.SUSPICIOUS_INPUT,
        message="probe",
        details={"api_key": TEST_SECRET, "note": "safe"},
    )
    assert event.details is not None
    assert event.details["api_key"] == REDACTED
    assert TEST_SECRET not in str(event.details)
