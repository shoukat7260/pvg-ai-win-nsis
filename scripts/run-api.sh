#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/services/api"

if [[ -f "$ROOT/.env" ]]; then
  # Safe dotenv load (handles spaces/quotes; never eval)
  eval "$(
    python3 - "$ROOT/.env" <<'PY'
import shlex, sys
from pathlib import Path
path = Path(sys.argv[1])
for raw in path.read_text().splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, _, val = line.partition("=")
    key = key.strip()
    val = val.strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1]
    if not key.isidentifier():
        continue
    print(f"export {key}={shlex.quote(val)}")
PY
  )"
fi

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
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:1420,http://localhost:5173,https://tauri.localhost,http://tauri.localhost,https://asset.localhost,http://asset.localhost,tauri://localhost}"
export API_PUBLIC_URL="${API_PUBLIC_URL:-http://62.171.139.173:8000}"

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
