"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import DbSessionDep, SettingsDep
from app.schemas.health import HealthResponse, ReadyResponse
from app.services.health import HealthService

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: SettingsDep) -> HealthResponse:
    return HealthService(settings).health()


@router.get("/ready", response_model=ReadyResponse)
async def ready(settings: SettingsDep, session: DbSessionDep) -> ReadyResponse:
    return await HealthService(settings).ready(session)
