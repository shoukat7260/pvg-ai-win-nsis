# PHASE 2 — Test Report

**Date:** 2026-09-29  
**Environment:** Linux, Postgres `:5444`, Redis `:6480`, `APP_ENV=test`  
**Critical note:** Backend pytest must run **alone** against the shared Docker DB (no parallel pytest processes).

---

## Summary

| Suite | Command | Result |
|-------|---------|--------|
| Full backend | `pytest -q` (services/api) | **86 passed** |
| Phase 1 regression subset | IDOR / RLS / tenant / ownership / test-header | **PASS** (included in full) |
| Phase 2 auth core | register/login/refresh/MFA/email/oauth/devices/payment | **PASS** |
| Web | `pnpm --filter @pvg/web test` | **11 passed** |
| Desktop | `pnpm --filter @pvg/desktop test` | **18 passed** |
| Rust | `cargo test -p pvg-vault -p pvg-core` | **21 passed** (15 core + 6 vault) |

---

## By area

| Area | Status |
|------|--------|
| Authentication | PASS |
| Authorization | PASS |
| Tenant isolation | PASS |
| Desktop / vault unit | PASS |
| Provider connections (no raw secrets in DB) | PASS |
| MFA | PASS |
| OAuth security | PASS |
| Billing sandbox | PASS |
| Regression (Phase 1) | PASS |
| Secret redaction | PASS |
| Rate limit | PASS |

---

## Desktop packaging

| Item | Status |
|------|--------|
| Rust crate tests | PASS |
| Signed Windows production installer | **Not built / not claimed** |

---

## Fixture hardening applied

1. MonkeyPatch: do not double-`setenv` restore values (was leaving `APP_ENV=development`).
2. Session-scoped schema + tenant seed with process guards (avoid concurrent `DROP SCHEMA` / `TRUNCATE` deadlocks).
3. Document solo pytest requirement for shared Postgres.

---

## Known limitations

- Console email in test/dev; SMTP for staging/production.
- Sandbox payments only (live processor DEFERRED).
- Live Google OAuth requires `GOOGLE_OAUTH_*`.
- Do not run two pytest processes against the same Postgres simultaneously.
