"""Migration / schema presence tests (Postgres)."""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


EXPECTED_TABLES = {
    "users",
    "workspaces",
    "workspace_members",
    "projects",
    "project_members",
    "assets",
    "generation_jobs",
    "provider_connections",
    "devices",
    "sessions",
    "audit_logs",
    "security_events",
    "oauth_identities",
    "mfa_methods",
    "mfa_recovery_codes",
    "email_verification_tokens",
    "password_reset_tokens",
    "auth_login_challenges",
    "desktop_auth_codes",
    "provider_usage_snapshots",
    "plans",
    "plan_features",
    "billing_customers",
    "subscriptions",
    "entitlements",
    "coupons",
    "trials",
    "payments",
    "invoices",
    "subscription_events",
}

RLS_TABLES = {
    "workspaces",
    "projects",
    "assets",
    "generation_jobs",
    "provider_connections",
    "sessions",
    "devices",
    "subscriptions",
}


@pytest.mark.asyncio
async def test_expected_tables_exist(admin_engine: AsyncEngine, prepare_schema: None) -> None:
    async with admin_engine.connect() as conn:
        result = await conn.execute(
            text(
                """
                SELECT tablename FROM pg_tables
                WHERE schemaname = 'public'
                """
            )
        )
        tables = {row[0] for row in result.fetchall()}
    assert EXPECTED_TABLES.issubset(tables)


@pytest.mark.asyncio
async def test_rls_enabled_and_forced(admin_engine: AsyncEngine, prepare_schema: None) -> None:
    async with admin_engine.connect() as conn:
        for table in RLS_TABLES:
            row = await conn.execute(
                text(
                    """
                    SELECT relrowsecurity, relforcerowsecurity
                    FROM pg_class
                    WHERE relname = :table
                    """
                ),
                {"table": table},
            )
            enabled, forced = row.one()
            assert enabled is True, f"RLS not enabled on {table}"
            assert forced is True, f"FORCE RLS not set on {table}"


@pytest.mark.asyncio
async def test_pvg_app_role_exists(admin_engine: AsyncEngine, prepare_schema: None) -> None:
    async with admin_engine.connect() as conn:
        row = await conn.execute(text("SELECT 1 FROM pg_roles WHERE rolname = 'pvg_app'"))
        assert row.scalar_one_or_none() == 1
