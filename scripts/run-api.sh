#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/services/api"

if [[ ! -d .venv ]]; then
  uv venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
uv pip install -e ".[dev]"

export APP_ENV="${APP_ENV:-development}"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5444/pvg}"
export DATABASE_ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5444/pvg}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6480/0}"
export JWT_SECRET="${JWT_SECRET:-dev_only_jwt_secret_change_for_real_deployments_32chars}"

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
