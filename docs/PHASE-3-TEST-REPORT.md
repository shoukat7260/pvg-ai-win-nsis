# PHASE 3 — Test Report

**Date:** 2026-09-29  
**Environment:** Linux; Postgres `:5444`; Redis `:6480`; FFmpeg may be on PATH

---

## Summary table

| Area | Tests | Pass | Fail | Notes |
|------|------:|-----:|-----:|-------|
| `@pvg/project-format` | 19 | 19 | 0 | Schema v2, migration, timecode |
| Desktop Vitest | 24 | 24 | 0 | Includes phase2 + phase3 media |
| Rust `pvg-core` | 22 | 22 | 0 | Project v2, paths, recovery |
| Rust `pvg-media` | 19 | 19 | 0 | Probe/jobs/proxy/path/import safety |
| Rust `pvg-vault` | 6 | 6 | 0 | Phase 2 vault regression |
| Backend pytest (P1+P2) | 86 | 86 | 0 | Solo run required |
| Full Tauri package build | — | — | — | Needs GTK/WebKit `-dev` (documented) |

---

## Commands

```bash
pnpm --filter @pvg/project-format test
pnpm --filter @pvg/desktop test
cd apps/desktop/src-tauri && cargo test -p pvg-core -p pvg-media -p pvg-vault

cd services/api && source .venv/bin/activate
# export APP_ENV=test + DB/JWT vars (see README)
pytest -q   # alone — no parallel pytest vs same Postgres
```

---

## Media / FFmpeg

| Check | Result |
|-------|--------|
| Argv-only invocation | PASS (unit) |
| Malicious filename single-arg | PASS |
| Derivative path escape | PASS |
| LINK source not deleted on remove | PASS |
| EngineUnavailable without ffprobe | PASS |
| Live 4K proxy timing | Manual UAT / host-dependent |

---

## Security regression

| Suite | Result |
|-------|--------|
| Phase 1 IDOR/RLS/tenant/path | PASS (via backend + pvg-core) |
| Phase 2 auth/session/vault/secrets | PASS |
| Phase 3 media path / injection | PASS (unit) |

---

## Performance smoke

Not claimed as production SLA. Local measurements belong in UAT (P3-M/N, 4K). UI remains event-driven; long work is job-queued.

---

## Known limitations

1. Browser Vite preview mocks media IPC — use `tauri:dev` for real FFmpeg.
2. Project create presets currently encode into description until create API accepts settings payload.
3. Full signed Windows installer not produced in this environment.
4. Sequence UI is foundation data only — not Phase 4 timeline editing.
5. Backend pytest must not run concurrently against shared Docker Postgres.
