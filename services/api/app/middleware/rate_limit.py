"""Rate limit middleware applied to foundation API routes."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import get_settings
from app.errors import error_body
from app.services.rate_limit import get_rate_limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Applies default per-IP rate limits to /api and /health foundation paths."""

    protected_prefixes = ("/api/", "/health", "/ready")

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path
        if not any(path == p or path.startswith(p) for p in self.protected_prefixes):
            return await call_next(request)

        settings = get_settings()
        limiter = get_rate_limiter()
        client_host = request.client.host if request.client else "unknown"
        user_hint = request.headers.get("X-Test-User-Id", "")
        key = f"ip:{client_host}:user:{user_hint}:path:{path}"
        result = limiter.check(key=key, limit=settings.rate_limit_default_per_minute)

        if not result.allowed:
            request_id = getattr(request.state, "request_id", None)
            return JSONResponse(
                status_code=429,
                content=error_body(
                    code="rate_limit_exceeded",
                    message="Rate limit exceeded",
                    request_id=request_id,
                ),
                headers={
                    "Retry-After": "60",
                    "X-RateLimit-Limit": str(result.limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(result.limit)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        return response
