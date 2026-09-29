# PVG AI API — Phase 1 Foundation

Production-minded FastAPI service with multi-tenant ownership checks, PostgreSQL RLS,
structured errors, secret redaction, audit/security events, and rate limiting.

## Requirements

- Python >= 3.12
- [uv](https://github.com/astral-sh/uv) (recommended) or pip
- PostgreSQL 16 (Docker Compose defaults below)
- Redis optional for readiness checks

## Quick start

```bash
cd services/api
uv sync --all-extras
# or: pip install -e ".[dev]"

export APP_ENV=development
export DATABASE_URL=postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5432/pvg
export DATABASE_ADMIN_URL=postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5432/pvg

# Migrate as pvg_migrator
uv run alembic upgrade head

# Run API
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Docker DB defaults

| Role | User | Password | DB | Port |
|------|------|----------|----|------|
| App (RLS subject) | `pvg_app` | `pvg_dev_change_me` | `pvg` | 5432 |
| Migrator (bypasses RLS) | `pvg_migrator` | `pvg_migrator_dev_change_me` | `pvg` | 5432 |

## Auth (Phase 1)

- Real session/JWT auth arrives in Phase 2.
- Test-only: when `APP_ENV=test`, send `X-Test-User-Id: <user-uuid>`.
- That header is **refused** in development, staging, and production (no backdoors).

## Endpoints

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Liveness |
| GET | `/ready` | DB (+ Redis best-effort) |
| GET | `/api/v1/me` | Current user |
| GET/POST | `/api/v1/workspaces` | List / create |
| GET/PATCH/DELETE | `/api/v1/workspaces/{id}` | Read / update / soft-delete |
| GET/POST | `/api/v1/projects` | List (requires `workspace_id`) / create |
| GET/PATCH/DELETE | `/api/v1/projects/{id}` | Read / update / soft-delete |

Errors:

```json
{ "error": { "code": "forbidden", "message": "...", "request_id": "..." } }
```

## Security rules

1. Never trust client `user_id` / `owner_id` / `created_by` for authorization.
2. Service-layer permission matrix + PostgreSQL RLS (defense in depth).
3. Secret redaction for `api_key`, `token`, `access_token`, `refresh_token`, `secret`, `password`, `authorization`, `credential`.
4. Roles: `pvg_migrator` (migrations), `pvg_app` (app, subject to RLS).

## Tests

```bash
cd services/api
export APP_ENV=test
export DATABASE_URL=postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5432/pvg
export DATABASE_ADMIN_URL=postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5432/pvg

uv sync --all-extras
uv run pytest -v
```

- Unit tests (config, redaction, permissions, rate limiter, health) run without Postgres.
- Integration / RLS / IDOR / tenant isolation / ownership / migrations **require** Docker Postgres.
- If Postgres is down, those tests skip (see `tests/conftest.py`). sqlite is not used for RLS.

### Security suites

- `test_idor.py` — 12 IDOR cases (cross-tenant URL/body/query attacks)
- `test_rls.py` — row-level security GUC isolation
- `test_tenant_isolation.py` — tenant A/B matrix
- `test_secret_leak.py` — `TEST_SECRET_123` never appears in logs/errors
- `test_authorization.py` — permission matrix

## Layout

See repository Phase 1 docs under `docs/security/` and `docs/architecture/`.
