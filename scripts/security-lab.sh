#!/usr/bin/env bash
# Security lab — TEST ENVIRONMENT ONLY
# Verifies tenant isolation, path traversal rejection, secret redaction, project validation.
# Never enables production bypasses.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export APP_ENV=test
export JWT_SECRET="${JWT_SECRET:-test_jwt_secret_not_for_production_use_32}"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5444/pvg}"
export DATABASE_ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5444/pvg}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6480/0}"

echo "[security-lab] Backend IDOR / RLS / tenant / secret tests"
(
  cd services/api
  # shellcheck disable=SC1091
  source .venv/bin/activate 2>/dev/null || true
  pytest -q tests/test_idor.py tests/test_rls.py tests/test_tenant_isolation.py tests/test_secret_leak.py tests/test_redaction.py tests/test_authorization.py
)

echo "[security-lab] Rust path traversal"
(
  cd apps/desktop/src-tauri/crates/pvg-core
  cargo test path -- --nocapture
)

echo "[security-lab] Project format validation"
pnpm --filter @pvg/project-format test

echo "[security-lab] PASS"
