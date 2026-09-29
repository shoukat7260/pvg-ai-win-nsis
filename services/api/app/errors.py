"""Typed application errors and structured JSON error responses."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.security.redaction import redact_mapping


class AppError(Exception):
    """Base application error with stable machine code."""

    code: str = "internal_error"
    status_code: int = 500
    message: str = "An unexpected error occurred"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class UnauthorizedError(AppError):
    code = "unauthorized"
    status_code = 401
    message = "Authentication required"


class ForbiddenError(AppError):
    code = "forbidden"
    status_code = 403
    message = "You do not have permission to perform this action"


class NotFoundError(AppError):
    code = "not_found"
    status_code = 404
    message = "Resource not found"


class ConflictError(AppError):
    code = "conflict"
    status_code = 409
    message = "Resource conflict"


class RateLimitError(AppError):
    code = "rate_limit_exceeded"
    status_code = 429
    message = "Rate limit exceeded"


class ValidationAppError(AppError):
    code = "validation_error"
    status_code = 422
    message = "Request validation failed"


def error_body(
    *,
    code: str,
    message: str,
    request_id: str | None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id,
        }
    }
    if details:
        payload["error"]["details"] = redact_mapping(details)
    return payload


def get_request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None) or request.headers.get("X-Request-ID")


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(
            code=exc.code,
            message=exc.message,
            request_id=get_request_id(request),
            details=exc.details or None,
        ),
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = "http_error"
    if exc.status_code == 401:
        code = "unauthorized"
    elif exc.status_code == 403:
        code = "forbidden"
    elif exc.status_code == 404:
        code = "not_found"
    elif exc.status_code == 429:
        code = "rate_limit_exceeded"
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code=code, message=detail, request_id=get_request_id(request)),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_body(
            code="validation_error",
            message="Request validation failed",
            request_id=get_request_id(request),
            details={"errors": exc.errors()},
        ),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=error_body(
            code="internal_error",
            message="An unexpected error occurred",
            request_id=get_request_id(request),
        ),
    )


def parse_uuid(value: str, *, field: str = "id") -> UUID:
    try:
        return UUID(str(value))
    except (ValueError, TypeError) as exc:
        raise ValidationAppError(f"Invalid {field}") from exc
