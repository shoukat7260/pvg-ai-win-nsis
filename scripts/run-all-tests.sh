#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAIL=0

echo "======== Frontend packages ========"
pnpm install
pnpm -r --filter './packages/*' test || FAIL=1
pnpm --filter @pvg/desktop test || FAIL=1

echo "======== Backend ========"
(
  cd services/api
  if [[ ! -d .venv ]]; then uv venv .venv; fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  uv pip install -e ".[dev]"
  export APP_ENV=test
  export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5444/pvg}"
  export DATABASE_ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5444/pvg}"
  export REDIS_URL="${REDIS_URL:-redis://localhost:6480/0}"
  export JWT_SECRET="test_jwt_secret_not_for_production_use_32"
  alembic upgrade head
  pytest -q
) || FAIL=1

echo "======== Rust ========"
(
  cd apps/desktop/src-tauri/crates/pvg-core
  cargo test
) || FAIL=1

echo "======== Security lab ========"
./scripts/security-lab.sh || FAIL=1

if [[ "$FAIL" -ne 0 ]]; then
  echo "PHASE 1 QUALITY GATE: FAIL"
  exit 1
fi
echo "PHASE 1 QUALITY GATE: PASS (still PENDING USER ACCEPTANCE)"
