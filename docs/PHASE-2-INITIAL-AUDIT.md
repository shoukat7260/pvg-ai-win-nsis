# PHASE 2 — Initial Repository Audit

**Date:** 2026-09-29  
**Status:** COMPLETE  
**Phase 1 status:** APPROVED

---

## 1. Repository state

| Item | Finding |
|------|---------|
| Branch | `main` (no commits yet; all Phase 1 untracked) |
| Phase 1 | Approved; foundation intact |
| Postgres | Docker `pvg-postgres` healthy on **5444** |
| Redis | Docker `pvg-redis` healthy on **6480** |
| Auth today | Test-only `X-Test-User-Id` when `APP_ENV=test` |
| Login UI | Desktop placeholder labeled Phase 2 |
| Vault | Memory/stub in Rust; OS-backed deferred |
| Migrations | `001_initial_schema` only |
| Web app | Scaffold only (`apps/web`) |
| Admin | Docs only |

---

## 2. What Phase 1 already provides (reuse)

| Area | Reuse |
|------|--------|
| Users / workspaces / projects / assets / provider_connections / devices / sessions | Extend — do not duplicate |
| Authorization service + permission matrix | Plug real principal into `AuthContext` |
| RLS + `pvg_app` / `pvg_migrator` | Keep; extend policies for new tables |
| Structured errors, request IDs, rate-limit middleware | Extend |
| Audit + security_events | Add Phase 2 event types |
| Secret redaction | Extend key list |
| `@pvg/api-client`, types, schemas | Extend contracts |
| Desktop shell, settings/security screens | Replace placeholders with real flows |
| `pvg-core` path security + narrow Tauri capabilities | Preserve |
| Config fail-closed for production | Extend with JWT issuer/audience, SMTP, OAuth, webhook secrets |

---

## 3. Phase 2 needs (gaps)

### Schema gaps
- Session family ID, last_seen_at, revoke_reason, created_from on `sessions`
- Richer `devices` (public id, os_version, app_version, architecture, trusted, revoked_at, last_ip)
- `oauth_identities`
- `mfa_methods`, `mfa_recovery_codes`
- `email_verification_tokens`, `password_reset_tokens`
- Provider connection: user/device scoped metadata, validation timestamps, method enum
- `provider_usage_snapshots`
- Billing: `plans`, `plan_features`, `subscriptions`, `entitlements`, `billing_customers`, `payments`, `invoices`, `coupons`, `trials`, `subscription_events`
- User status values: pending_verification, active, suspended, disabled, deleted

### Security gaps to close
- Real password auth (Argon2id)
- Access + refresh with rotation / reuse detection
- Email verification + password reset (hashed tokens)
- Google OAuth/OIDC + desktop PKCE browser flow
- TOTP MFA + hashed recovery codes
- Cookie session security for web (HttpOnly/Secure/SameSite + CSRF)
- OS-backed vault for provider secrets + desktop refresh credential
- Brute-force layered rate limits
- Payment webhook signature verification + idempotency (sandbox)

### Frontend / Tauri changes
- Real auth routes (web + desktop)
- AuthProvider state machine
- Devices / sessions / security activity / connections / billing UI
- Desktop “Continue in browser” login
- Narrow vault IPC only

---

## 4. Assumptions

1. Email in development/test uses console/file transport; SMTP required only for staging/production.
2. Google OAuth credentials optional in development; flow implemented; live Google requires env secrets.
3. Payment provider: **sandbox/mock adapter** unless concrete processor already configured (none found) — not a fake live integration.
4. Provider adapters validate credentials only where protocols are stable; otherwise `NOT_SUPPORTED`.
5. Provider raw secrets remain **device-local**; cloud stores metadata only.
6. `X-Test-User-Id` remains **test-only** forever.
7. Plans: FREE / CREATOR / PRO / AGENCY with data-driven entitlements.
8. Desktop vault: Tauri Stronghold or OS keyring; prefer portable `keyring` + encrypted store with documented Windows DPAPI/Stronghold path.

---

## 5. Deferred (not Phase 2 product features)

Timeline, AI generation, FFmpeg, Whisper, marketplace, plugins, team collaboration UI, live payment processor unless configured.

---

## 6. Proposed change strategy

1. New Alembic migration `002_phase2_auth_billing` (never 001; never rewrite 001).
2. Auth module under `services/api/app/auth/` and `services/` for passwords, sessions, tokens, MFA, OAuth.
3. Replace placeholder login with real flows; keep Phase 1 workspace/project APIs behind real auth.
4. Expand `apps/web` into authenticated marketing/account shell for signup/login/verify/billing.
5. Desktop: browser-based auth + vault commands.
6. Full security test suites + Phase 1 regression.

---

## 7. Audit outcome

Proceed with Phase 2 implementation order (STEPS 3–34).  
**Do not mark Phase 2 approved** until user manual acceptance.
