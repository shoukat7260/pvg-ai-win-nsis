"""Pytest fixtures for PVG API.

Database strategy
-----------------
* Prefer PostgreSQL (Docker compose defaults) for integration, RLS, IDOR,
  ownership, and tenant isolation tests.
* Pure unit tests (config, redaction, permission matrix, rate limiter) run
  without a database.
* If Postgres is unavailable, Postgres-dependent tests are skipped.
  sqlite+aiosqlite is used only for a limited in-memory path when explicitly
  needed for pure service logic — RLS tests ALWAYS require Postgres.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

_DB_SEED_FILELOCK = Path("/tmp/pvg_api_test_db.lock")
_seed_async_lock: asyncio.Lock | None = None
_schema_thread_lock = __import__("threading").Lock()
_TENANTS_CACHE: tuple | None = None
_SCHEMA_READY = False


def _get_seed_lock() -> asyncio.Lock:
    global _seed_async_lock
    if _seed_async_lock is None:
        _seed_async_lock = asyncio.Lock()
    return _seed_async_lock

# Force test environment before app imports
os.environ["APP_ENV"] = "test"
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5444/pvg",
)
os.environ.setdefault(
    "DATABASE_ADMIN_URL",
    "postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5444/pvg",
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6480/0")
os.environ.setdefault("JWT_SECRET", "test_jwt_secret_not_for_production_use_32")
os.environ.setdefault("JWT_ISSUER", "pvg-ai")
os.environ.setdefault("JWT_AUDIENCE", "pvg-api")
os.environ.setdefault("EMAIL_TRANSPORT", "console")
os.environ.setdefault("PAYMENT_PROVIDER", "sandbox")
os.environ.setdefault("PAYMENT_WEBHOOK_SECRET", "test_webhook_secret_32chars_min")
os.environ.setdefault("MFA_ENCRYPTION_KEY", "UhC5MIGmK2lFWjv3qKbT0reAKcw1-S-IFg1DtAYQMRE=")
os.environ.setdefault("CSRF_SECRET", "test_csrf_secret_not_for_production_32")
os.environ.setdefault("RATE_LIMIT_DEFAULT_PER_MINUTE", "10000")
os.environ.setdefault("RATE_LIMIT_AUTH_PER_MINUTE", "10000")
os.environ.setdefault("RATE_LIMIT_AUTH_ACCOUNT_PER_MINUTE", "10000")

from app.config import clear_settings_cache, get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
import app.models  # noqa: E402,F401 — register all Phase 1+2 tables on Base.metadata
from app.db.session import dispose_engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.asset import Asset  # noqa: E402
from app.models.billing import Plan, PlanFeature  # noqa: E402
from app.models.enums import PlanCode, WorkspaceRole  # noqa: E402
from app.models.generation import GenerationJob  # noqa: E402
from app.models.project import Project  # noqa: E402
from app.models.provider import ProviderConnection  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.workspace import Workspace, WorkspaceMember  # noqa: E402
from app.services.email_service import clear_console_outbox  # noqa: E402
from app.services.rate_limit import get_rate_limiter  # noqa: E402

clear_settings_cache()

PHASE2_TABLES = (
    "subscription_events",
    "invoices",
    "payments",
    "trials",
    "coupons",
    "entitlements",
    "subscriptions",
    "billing_customers",
    "provider_usage_snapshots",
    "desktop_auth_codes",
    "auth_login_challenges",
    "password_reset_tokens",
    "email_verification_tokens",
    "mfa_recovery_codes",
    "mfa_methods",
    "oauth_identities",
)

# Catalog tables seeded once — do not truncate per test (avoids races / UniqueViolation)
CATALOG_TABLES = (
    "plan_features",
    "plans",
)

ALL_APP_TABLES = PHASE2_TABLES + CATALOG_TABLES + (
    "security_events",
    "audit_logs",
    "sessions",
    "devices",
    "provider_connections",
    "generation_jobs",
    "assets",
    "project_members",
    "projects",
    "workspace_members",
    "workspaces",
    "users",
)

TRUNCATE_TABLES = PHASE2_TABLES + (
    "security_events",
    "audit_logs",
    "sessions",
    "devices",
    "provider_connections",
    "generation_jobs",
    "assets",
    "project_members",
    "projects",
    "workspace_members",
    "workspaces",
    "users",
)


@dataclass
class TenantFixture:
    user: User
    workspace: Workspace
    project: Project
    asset: Asset
    generation: GenerationJob
    connection: ProviderConnection


async def _postgres_available(url: str) -> bool:
    engine = create_async_engine(url, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> None:
    get_rate_limiter().reset()
    clear_console_outbox()
    # Guard against tests that mutate APP_ENV via MonkeyPatch incorrectly
    os.environ["APP_ENV"] = "test"
    clear_settings_cache()
    yield
    get_rate_limiter().reset()
    clear_console_outbox()
    os.environ["APP_ENV"] = "test"
    clear_settings_cache()


@pytest.fixture(scope="session")
def postgres_urls() -> tuple[str, str]:
    settings = get_settings()
    return settings.database_url, settings.database_admin_url


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def postgres_ready(postgres_urls: tuple[str, str]) -> bool:
    app_url, admin_url = postgres_urls
    return await _postgres_available(app_url) and await _postgres_available(admin_url)


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def admin_engine(postgres_ready: bool, postgres_urls: tuple[str, str]) -> AsyncIterator[AsyncEngine]:
    if not postgres_ready:
        pytest.skip("PostgreSQL unavailable — integration/RLS tests require Docker Postgres")
    _, admin_url = postgres_urls
    engine = create_async_engine(admin_url, pool_pre_ping=True)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def app_engine(postgres_ready: bool, postgres_urls: tuple[str, str]) -> AsyncIterator[AsyncEngine]:
    if not postgres_ready:
        pytest.skip("PostgreSQL unavailable — integration/RLS tests require Docker Postgres")
    app_url, _ = postgres_urls
    engine = create_async_engine(app_url, pool_pre_ping=True)
    yield engine
    await engine.dispose()


def _user_rls_sql(table: str) -> list[str]:
    policy = (
        "(user_id::text = current_setting('app.current_user_id', true) "
        "OR current_setting('app.auth_lookup', true) = '1')"
    )
    return [
        f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY",
        f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY",
        f"CREATE POLICY {table}_select_policy ON {table} FOR SELECT TO pvg_app USING ({policy})",
        f"""CREATE POLICY {table}_insert_policy ON {table} FOR INSERT TO pvg_app WITH CHECK (
            user_id::text = current_setting('app.current_user_id', true)
            OR current_setting('app.auth_lookup', true) = '1'
        )""",
        f"CREATE POLICY {table}_update_policy ON {table} FOR UPDATE TO pvg_app USING ({policy}) WITH CHECK ({policy})",
        f"CREATE POLICY {table}_delete_policy ON {table} FOR DELETE TO pvg_app USING ({policy})",
    ]


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def prepare_schema(admin_engine: AsyncEngine) -> None:
    """Create tables via metadata for tests (mirrors migration shape + RLS via SQL)."""
    global _TENANTS_CACHE, _SCHEMA_READY
    if _SCHEMA_READY:
        return
    with _schema_thread_lock:
        if _SCHEMA_READY:
            return
        _TENANTS_CACHE = None
        async with admin_engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    DO $$
                    BEGIN
                      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pvg_migrator') THEN
                        CREATE ROLE pvg_migrator LOGIN PASSWORD 'pvg_migrator_dev_change_me';
                      END IF;
                      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pvg_app') THEN
                        CREATE ROLE pvg_app LOGIN PASSWORD 'pvg_dev_change_me';
                      END IF;
                    END $$;
                    """
                )
            )
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO CURRENT_USER"))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO pvg_migrator"))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO pvg_app"))
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER ROLE pvg_migrator BYPASSRLS"))
            await conn.execute(text("ALTER ROLE pvg_app NOBYPASSRLS"))

            for table in ALL_APP_TABLES:
                await conn.execute(
                    text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {table} TO pvg_app")
                )

            await conn.execute(text("ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY"))
            await conn.execute(text("ALTER TABLE workspaces FORCE ROW LEVEL SECURITY"))
            for tbl in ("projects", "assets", "generation_jobs", "workspace_members"):
                await conn.execute(text(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY"))
                await conn.execute(text(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY"))

            workspace_policy = """
                id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
                OR EXISTS (
                  SELECT 1 FROM workspace_members wm
                  WHERE wm.workspace_id = workspaces.id
                    AND wm.user_id::text = current_setting('app.current_user_id', true)
                )
            """

            async def _create_tenant_policies(table: str, policy: str) -> None:
                await conn.execute(
                    text(
                        f"""
                        CREATE POLICY {table}_select_policy ON {table}
                          FOR SELECT TO pvg_app USING ({policy})
                        """
                    )
                )
                await conn.execute(
                    text(
                        f"""
                        CREATE POLICY {table}_insert_policy ON {table}
                          FOR INSERT TO pvg_app WITH CHECK ({policy})
                        """
                    )
                )
                await conn.execute(
                    text(
                        f"""
                        CREATE POLICY {table}_update_policy ON {table}
                          FOR UPDATE TO pvg_app USING ({policy}) WITH CHECK ({policy})
                        """
                    )
                )
                await conn.execute(
                    text(
                        f"""
                        CREATE POLICY {table}_delete_policy ON {table}
                          FOR DELETE TO pvg_app USING ({policy})
                        """
                    )
                )

            await _create_tenant_policies("workspaces", workspace_policy)
            await conn.execute(text("DROP POLICY IF EXISTS workspaces_insert_policy ON workspaces"))
            await conn.execute(
                text(
                    """
                    CREATE POLICY workspaces_insert_policy ON workspaces
                      FOR INSERT TO pvg_app
                      WITH CHECK (
                        owner_id::text = current_setting('app.current_user_id', true)
                      )
                    """
                )
            )

            for tbl in ("projects", "assets", "generation_jobs"):
                policy = f"""
                    workspace_id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
                    OR EXISTS (
                      SELECT 1 FROM workspace_members wm
                      WHERE wm.workspace_id = {tbl}.workspace_id
                        AND wm.user_id::text = current_setting('app.current_user_id', true)
                    )
                """
                await _create_tenant_policies(tbl, policy)

            dual_policy = """
                (
                  workspace_id IS NOT NULL AND (
                    workspace_id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
                    OR EXISTS (
                      SELECT 1 FROM workspace_members wm
                      WHERE wm.workspace_id = provider_connections.workspace_id
                        AND wm.user_id::text = current_setting('app.current_user_id', true)
                    )
                  )
                )
                OR (
                  user_id IS NOT NULL
                  AND user_id::text = current_setting('app.current_user_id', true)
                )
            """
            await conn.execute(text("ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY"))
            await conn.execute(text("ALTER TABLE provider_connections FORCE ROW LEVEL SECURITY"))
            await _create_tenant_policies("provider_connections", dual_policy)

            members_policy = """
                user_id::text = current_setting('app.current_user_id', true)
                OR workspace_id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
            """
            await _create_tenant_policies("workspace_members", members_policy)

            for table in (
                "sessions",
                "devices",
                "oauth_identities",
                "mfa_methods",
                "mfa_recovery_codes",
                "email_verification_tokens",
                "password_reset_tokens",
                "auth_login_challenges",
                "desktop_auth_codes",
                "provider_usage_snapshots",
                "billing_customers",
                "subscriptions",
                "entitlements",
                "trials",
                "payments",
                "invoices",
                "subscription_events",
            ):
                for stmt in _user_rls_sql(table):
                    await conn.execute(text(stmt))

            for table in ("plans", "plan_features", "coupons"):
                await conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
                await conn.execute(text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
                await conn.execute(
                    text(
                        f"""
                        CREATE POLICY {table}_select_policy ON {table}
                          FOR SELECT TO pvg_app
                          USING (true)
                        """
                    )
                )

        factory = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)
        async with factory() as session:
            await _seed_plans(session)
            await session.commit()
        _SCHEMA_READY = True



async def _seed_plans(session: AsyncSession) -> None:
    result = await session.execute(text("SELECT count(*) FROM plans"))
    if int(result.scalar_one()) > 0:
        return
    plans = [
        (PlanCode.FREE.value, "Free", 0, 0),
        (PlanCode.CREATOR.value, "Creator", 1900, 1),
        (PlanCode.PRO.value, "Pro", 4900, 2),
        (PlanCode.AGENCY.value, "Agency", 14900, 3),
    ]
    plan_ids: dict[str, uuid.UUID] = {}
    for code, name, price, order in plans:
        pid = uuid.uuid4()
        plan_ids[code] = pid
        session.add(
            Plan(
                id=pid,
                code=code,
                name=name,
                price_cents=price,
                sort_order=order,
            )
        )
    await session.flush()
    features = {
        PlanCode.FREE.value: [
            ("workspaces", "1", 1),
            ("projects", "3", 3),
            ("ai_generations_monthly", "10", 10),
            ("devices", "2", 2),
        ],
        PlanCode.CREATOR.value: [
            ("workspaces", "3", 3),
            ("projects", "25", 25),
            ("ai_generations_monthly", "200", 200),
            ("devices", "5", 5),
        ],
        PlanCode.PRO.value: [
            ("workspaces", "10", 10),
            ("projects", "unlimited", None),
            ("ai_generations_monthly", "1000", 1000),
            ("devices", "15", 15),
        ],
        PlanCode.AGENCY.value: [
            ("workspaces", "unlimited", None),
            ("projects", "unlimited", None),
            ("ai_generations_monthly", "5000", 5000),
            ("devices", "unlimited", None),
        ],
    }
    for code, feats in features.items():
        for key, value, limit in feats:
            session.add(
                PlanFeature(
                    id=uuid.uuid4(),
                    plan_id=plan_ids[code],
                    feature_key=key,
                    feature_value=value,
                    limit_value=limit,
                )
            )
    await session.flush()


async def _make_tenant(
    session: AsyncSession,
    *,
    email: str,
    display_name: str,
    workspace_name: str,
    project_name: str,
) -> TenantFixture:
    user = User(
        id=uuid.uuid4(),
        email=email,
        normalized_email=email.lower(),
        display_name=display_name,
        status="active",
    )
    session.add(user)
    await session.flush()

    workspace = Workspace(
        id=uuid.uuid4(),
        name=workspace_name,
        type="personal",
        owner_id=user.id,
    )
    session.add(workspace)
    await session.flush()

    session.add(
        WorkspaceMember(
            id=uuid.uuid4(),
            workspace_id=workspace.id,
            user_id=user.id,
            role=WorkspaceRole.OWNER.value,
        )
    )
    await session.flush()

    project = Project(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        name=project_name,
        created_by=user.id,
    )
    session.add(project)
    await session.flush()

    asset = Asset(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        project_id=project.id,
        name=f"{project_name}-asset",
        kind="video",
        created_by=user.id,
    )
    generation = GenerationJob(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        project_id=project.id,
        created_by=user.id,
        status="pending",
        provider_type="other",
    )
    connection = ProviderConnection(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        user_id=user.id,
        provider_type="openai",
        display_name=f"{display_name} connection",
        credential_ref="vault:ref-test",
        created_by=user.id,
    )
    session.add_all([asset, generation, connection])
    await session.flush()

    return TenantFixture(
        user=user,
        workspace=workspace,
        project=project,
        asset=asset,
        generation=generation,
        connection=connection,
    )


async def _seed_security_tenants(session: AsyncSession) -> tuple[TenantFixture, TenantFixture]:
    """Insert fixed A/B tenants (caller holds locks / transaction)."""
    await _seed_plans(session)
    tenant_a = await _make_tenant(
        session,
        email="security-test-user-a@example.com",
        display_name="security-test-user-a",
        workspace_name="workspace_a",
        project_name="project_a",
    )
    tenant_b = await _make_tenant(
        session,
        email="security-test-user-b@example.com",
        display_name="security-test-user-b",
        workspace_name="workspace_b",
        project_name="project_b",
    )
    return tenant_a, tenant_b


async def _tenants_still_present(session: AsyncSession, cached: tuple[TenantFixture, TenantFixture]) -> bool:
    for tenant in cached:
        row = await session.execute(
            text("SELECT 1 FROM users WHERE id = :id"),
            {"id": str(tenant.user.id)},
        )
        if row.scalar_one_or_none() is None:
            return False
    return True


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def seeded_tenants(
    admin_engine: AsyncEngine, prepare_schema: None
) -> tuple[TenantFixture, TenantFixture]:
    """Create security-test tenants A/B once; refresh if another test wiped them."""
    global _TENANTS_CACHE

    async with _get_seed_lock():
        _DB_SEED_FILELOCK.touch(exist_ok=True)
        fd = os.open(_DB_SEED_FILELOCK, os.O_RDWR)
        try:
            import fcntl

            fcntl.flock(fd, fcntl.LOCK_EX)
            factory = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)
            async with factory() as session:
                await session.execute(text("SELECT pg_advisory_xact_lock(8723641)"))
                if _TENANTS_CACHE is not None and await _tenants_still_present(session, _TENANTS_CACHE):
                    return _TENANTS_CACHE
                tables = ", ".join(TRUNCATE_TABLES)
                await session.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
                _TENANTS_CACHE = await _seed_security_tenants(session)
                await session.commit()
                return _TENANTS_CACHE
        finally:
            try:
                import fcntl

                fcntl.flock(fd, fcntl.LOCK_UN)
            finally:
                os.close(fd)


@pytest_asyncio.fixture
async def tenant_a(
    seeded_tenants: tuple[TenantFixture, TenantFixture], admin_engine: AsyncEngine
) -> TenantFixture:
    """Return tenant A, re-seeding if the session cache went stale."""
    global _TENANTS_CACHE
    factory = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        if await _tenants_still_present(session, seeded_tenants):
            return seeded_tenants[0]
    async with _get_seed_lock():
        async with factory() as session:
            await session.execute(text("SELECT pg_advisory_xact_lock(8723641)"))
            if _TENANTS_CACHE is not None and await _tenants_still_present(session, _TENANTS_CACHE):
                return _TENANTS_CACHE[0]
            tables = ", ".join(TRUNCATE_TABLES)
            await session.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
            _TENANTS_CACHE = await _seed_security_tenants(session)
            await session.commit()
    assert _TENANTS_CACHE is not None
    return _TENANTS_CACHE[0]


@pytest_asyncio.fixture
async def tenant_b(
    seeded_tenants: tuple[TenantFixture, TenantFixture],
    admin_engine: AsyncEngine,
    tenant_a: TenantFixture,
) -> TenantFixture:
    """Return tenant B (tenant_a ensures re-seed if needed)."""
    global _TENANTS_CACHE
    cached = _TENANTS_CACHE or seeded_tenants
    return cached[1]


@pytest_asyncio.fixture
async def db_session(app_engine: AsyncEngine, prepare_schema: None) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(app_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def admin_session(admin_engine: AsyncEngine, prepare_schema: None) -> AsyncIterator[AsyncSession]:
    """Privileged DB session. Does not truncate — use seeded_tenants for isolation."""
    factory = async_sessionmaker(admin_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.commit()


@pytest_asyncio.fixture
async def app_client(
    app_engine: AsyncEngine,
    prepare_schema: None,
    seeded_tenants: tuple[TenantFixture, TenantFixture],
) -> AsyncIterator[AsyncClient]:
    """HTTP client wired to the FastAPI app with test DB sessions."""
    clear_settings_cache()
    await dispose_engine()

    factory = async_sessionmaker(app_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_db() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    application = create_app()
    from app.db.session import get_db_session

    application.dependency_overrides[get_db_session] = _override_db

    transport = ASGITransport(app=application)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    application.dependency_overrides.clear()
    await dispose_engine()
    clear_settings_cache()


@pytest.fixture
def auth_headers_a(tenant_a: TenantFixture) -> dict[str, str]:
    return {"X-Test-User-Id": str(tenant_a.user.id)}


@pytest.fixture
def auth_headers_b(tenant_b: TenantFixture) -> dict[str, str]:
    return {"X-Test-User-Id": str(tenant_b.user.id)}
