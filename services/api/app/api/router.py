"""Top-level API router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    account,
    auth,
    billing,
    connections,
    desktop_auth,
    devices,
    health,
    me,
    mfa,
    oauth,
    projects,
    sessions,
    workspaces,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(me.router, prefix="/api/v1")
api_router.include_router(workspaces.router, prefix="/api/v1")
api_router.include_router(projects.router, prefix="/api/v1")
api_router.include_router(auth.router, prefix="/api/v1")
api_router.include_router(mfa.router, prefix="/api/v1")
api_router.include_router(account.router, prefix="/api/v1")
api_router.include_router(devices.router, prefix="/api/v1")
api_router.include_router(sessions.router, prefix="/api/v1")
api_router.include_router(oauth.router, prefix="/api/v1")
api_router.include_router(desktop_auth.router, prefix="/api/v1")
api_router.include_router(connections.router, prefix="/api/v1")
api_router.include_router(billing.router, prefix="/api/v1")
