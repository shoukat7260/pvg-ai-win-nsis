"""Secret redaction tests."""

from __future__ import annotations

from app.security.redaction import REDACTED, redact_event_dict, redact_mapping, redact_string


def test_redacts_sensitive_keys() -> None:
    payload = {
        "api_key": "TEST_SECRET_123",
        "token": "TEST_SECRET_123",
        "access_token": "TEST_SECRET_123",
        "refresh_token": "TEST_SECRET_123",
        "secret": "TEST_SECRET_123",
        "password": "TEST_SECRET_123",
        "authorization": "Bearer TEST_SECRET_123",
        "credential": "TEST_SECRET_123",
        "safe": "visible",
    }
    redacted = redact_mapping(payload)
    for key in (
        "api_key",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "password",
        "authorization",
        "credential",
    ):
        assert redacted[key] == REDACTED
        assert "TEST_SECRET_123" not in str(redacted[key])
    assert redacted["safe"] == "visible"


def test_nested_redaction() -> None:
    payload = {"user": {"password": "TEST_SECRET_123", "name": "a"}, "items": [{"api_key": "TEST_SECRET_123"}]}
    redacted = redact_mapping(payload)
    assert "TEST_SECRET_123" not in str(redacted)
    assert redacted["user"]["name"] == "a"


def test_string_bearer_redaction() -> None:
    text = "Authorization: Bearer TEST_SECRET_123"
    assert "TEST_SECRET_123" not in redact_string(text)


def test_structlog_processor() -> None:
    event = {"event": "login", "password": "TEST_SECRET_123", "user": "a"}
    out = redact_event_dict(None, "info", event)
    assert out["password"] == REDACTED
    assert "TEST_SECRET_123" not in str(out)
