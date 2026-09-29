#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Starting PostgreSQL + Redis"
docker compose -f infrastructure/docker/compose.yml up -d postgres redis

echo "==> Waiting for health"
for i in {1..30}; do
  if docker exec pvg-postgres pg_isready -U pvg_migrator -d pvg >/dev/null 2>&1 \
     && docker exec pvg-redis redis-cli ping >/dev/null 2>&1; then
    echo "Services ready"
    break
  fi
  sleep 1
done

echo "==> Done. Start API with: ./scripts/run-api.sh"
