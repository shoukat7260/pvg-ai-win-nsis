"""Health and readiness checks."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.schemas.health import HealthResponse, ReadyResponse


class HealthService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def health(self) -> HealthResponse:
        return HealthResponse(
            status="ok",
            service=self.settings.app_name,
            version=self.settings.app_version,
            env=self.settings.app_env,
        )

    async def ready(self, session: AsyncSession) -> ReadyResponse:
        db_status = "ok"
        try:
            await session.execute(text("SELECT 1"))
        except Exception:
            db_status = "unavailable"

        redis_status: str | None = "skipped"
        try:
            import redis.asyncio as redis

            client = redis.from_url(self.settings.redis_url, socket_connect_timeout=0.5)
            try:
                await client.ping()
                redis_status = "ok"
            finally:
                await client.aclose()
        except Exception:
            redis_status = "unavailable"

        overall = "ok" if db_status == "ok" else "degraded"
        return ReadyResponse(status=overall, database=db_status, redis=redis_status)
