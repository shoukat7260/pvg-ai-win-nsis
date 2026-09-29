"""Secret redaction for logs, errors, and diagnostics."""

from __future__ import annotations

import re
from typing import Any

REDACTED = "[REDACTED]"

SENSITIVE_KEYS = frozenset(
    {
        "api_key",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "password",
        "authorization",
        "credential",
        "password_hash",
        "jwt_secret",
        "credential_vault_master_key",
    }
)

_SENSITIVE_KEY_RE = re.compile(
    r"(" + "|".join(re.escape(k) for k in sorted(SENSITIVE_KEYS, key=len, reverse=True)) + r")",
    re.IGNORECASE,
)

_BEARER_RE = re.compile(r"(Bearer\s+)(\S+)", re.IGNORECASE)
_KV_SECRET_RE = re.compile(
    r"(?i)\b("
    + "|".join(re.escape(k) for k in SENSITIVE_KEYS)
    + r")\b(\s*[:=]\s*)([^\s,;\"'}]+)"
)


def is_sensitive_key(key: str) -> bool:
    normalized = key.strip().lower().replace("-", "_")
    if normalized in SENSITIVE_KEYS:
        return True
    return any(part in SENSITIVE_KEYS for part in normalized.split("_") if part)


def redact_value(value: Any) -> Any:
    if isinstance(value, dict):
        return redact_mapping(value)
    if isinstance(value, list):
        return [redact_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact_value(item) for item in value)
    if isinstance(value, str):
        return redact_string(value)
    return value


def redact_mapping(data: dict[str, Any]) -> dict[str, Any]:
    redacted: dict[str, Any] = {}
    for key, value in data.items():
        if is_sensitive_key(str(key)):
            redacted[key] = REDACTED
        else:
            redacted[key] = redact_value(value)
    return redacted


def redact_string(text: str) -> str:
    text = _BEARER_RE.sub(rf"\1{REDACTED}", text)
    text = _KV_SECRET_RE.sub(rf"\1\2{REDACTED}", text)
    return text


def redact_event_dict(_logger: Any, _method: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    """structlog processor that redacts sensitive fields."""
    return redact_mapping(event_dict)
