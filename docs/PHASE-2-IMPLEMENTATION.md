# PHASE 2 — Implementation Report

**Product:** PVG AI (Product Generator AI)  
**Phase:** 2 — Identity, Authentication, Devices, Vault, Providers, Subscriptions & Billing  
**Date:** 2026-09-29  
**Status:** READY FOR USER ACCEPTANCE (not approved)

Phase 1 remains **APPROVED**. Phase 2 extends it; it does not replace the foundation.

---

## 1. What was delivered

### Authentication
- Registration, email verification, login, logout, refresh
- Argon2id password hashing (rehash-on-login when parameters drift)
- Password reset (hashed, single-use, TTL tokens)
- Account status machine: `pending_verification` → `active` / `suspended` / `disabled` / `deleted`
- Generic auth errors (no account enumeration on login/reset)
- `GET /api/v1/me` from authenticated session only

### Sessions & devices
- Short-lived JWT access tokens (`sub`, `sid`, `iat`, `exp`, `iss`, `aud`, `jti`, `typ=access`)
- Opaque refresh tokens stored as SHA-256 hashes; rotation + family revoke on reuse
- Web: HttpOnly refresh cookie + CSRF double-submit
- Desktop: refresh credential in OS-backed vault (`pvg-vault` / keyring, memory fallback for CI)
- Device registration and management (list, rename, revoke, sign out others)

### OAuth / desktop login
- Google OAuth/OIDC server-side flow (live credentials optional via `GOOGLE_OAUTH_*`)
- Desktop browser login with authorization code + PKCE (`/api/v1/auth/desktop/*`)
- State/PKCE validation; no client secrets in Tauri frontend

### MFA
- TOTP enable/verify/disable with encrypted secret at rest
- Hashed one-time recovery codes; regenerate invalidates prior set
- Step-up / recent-auth expectations documented for sensitive actions

### Provider connections
- Cloud stores **metadata only** (no raw API keys in PostgreSQL)
- Desktop vault: narrow IPC (`save` / `get` / `delete` / `has` provider credential)
- Device-scoped secrets: Device B does not receive Device A keys
- Connection adapters with `NOT_SUPPORTED` for unimplemented provider ops
- Usage/balance abstraction with honest `AVAILABLE` / `UNAVAILABLE` / `NOT_SUPPORTED` / `ERROR`

### Subscriptions & billing
- Plans: FREE / CREATOR / PRO / AGENCY (data-driven)
- `EntitlementService` (named entitlements, not `if plan == "pro"`)
- Subscription states: trialing, active, past_due, paused, canceled, expired, incomplete
- `PaymentProvider` abstraction + **SandboxPaymentProvider** (not a fake live processor)
- Webhook signature verification + idempotent provider event IDs
- Trial/coupon foundation tables and validation hooks

### Frontend / desktop
- Web: signup, login, verify-email, forgot/reset, dashboard, settings (account/security/devices/connections/billing)
- Desktop: `AuthGate`, real login (not Phase 1 placeholder), connections/security/billing settings
- Auth state machine: UNKNOWN → AUTHENTICATING → AUTHENTICATED / UNAUTHENTICATED / SESSION_EXPIRED

### Security hardening
- `X-Test-User-Id` **only** when `APP_ENV=test` (regression covered)
- Layered rate limits (IP + account) for auth endpoints
- Secret redaction extended (password, tokens, TOTP, recovery, payment)
- Production fail-closed config (JWT, CSRF, MFA key, webhook secret, CORS)
- Auth/security audit event types for Phase 2 lifecycle

---

## 2. Database

New Alembic migration: `002_phase2_identity_billing.py` (does not edit `001`).

Extends/creates: oauth identities, MFA, verification/reset tokens, session/device enrichments, provider usage snapshots, plans/features, subscriptions, entitlements, billing customers, payments, invoices, coupons, trials, subscription events, desktop auth codes, login challenges.

RLS: user-scoped tables use `app.current_user_id` with trusted `app.auth_lookup` for hash-based token exchange.

---

## 3. Key API surface (`/api/v1`)

| Area | Prefix |
|------|--------|
| Auth | `/auth/*` |
| Me | `/me` |
| Account | `/account/*` |
| MFA | `/mfa/*` |
| Devices | `/devices/*` |
| Sessions | `/sessions/*` |
| OAuth Google | `/oauth/google/*` |
| Desktop auth | `/auth/desktop/*` |
| Connections | `/connections/*` |
| Billing | `/billing/*` |

Structured errors retain Phase 1 shape: `{ "error": { "code", "message", "request_id" } }`.

---

## 4. Explicit deferrals

| Item | Status |
|------|--------|
| Live Stripe/Braintree/etc. | DEFERRED — sandbox adapter only |
| Live Google OAuth without env secrets | Requires `GOOGLE_OAUTH_*` |
| SMTP in production | Requires `SMTP_*` when `EMAIL_TRANSPORT=smtp` |
| Actual AI generation / editor | Phase 3+ |
| Signed Windows production installer | Environment-dependent; see test report |
| Full admin product UI | Out of scope |

---

## 5. Separation of concerns (permanent)

| Layer | Holds |
|-------|--------|
| PVG Cloud | Identity, sessions metadata, devices, entitlements, billing refs, provider **metadata**, audit |
| User device | Local projects, provider **secrets**, desktop refresh credential, vault |
| AI providers | Generation, provider-side usage/billing |

---

## 6. Documentation index

- `docs/PHASE-2-INITIAL-AUDIT.md`
- `docs/PHASE-2-IMPLEMENTATION.md` (this file)
- `docs/PHASE-2-TEST-REPORT.md`
- `docs/PHASE-2-USER-ACCEPTANCE.md`
- `docs/security/AUTHENTICATION-ARCHITECTURE.md`
- `docs/security/SESSION-ARCHITECTURE.md`
- `docs/security/OAUTH-DESKTOP-FLOW.md`
- `docs/security/MFA-ARCHITECTURE.md`
- `docs/security/PROVIDER-CREDENTIAL-ARCHITECTURE.md`
- `docs/security/BILLING-SECURITY.md`
- `docs/security/PHASE-2-SECURITY-REVIEW.md`
- `docs/support/AUTH-SUPPORT-RUNBOOK.md`
