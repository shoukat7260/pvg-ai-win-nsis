# PHASE 2 — User Acceptance Test Plan

**Product:** PVG AI  
**Phase:** 2 — Identity, Authentication, Devices, Vault, Providers, Subscriptions  
**Status:** PENDING USER ACCEPTANCE (do not auto-approve)

---

## How to use

For each test: follow **STEPS**, compare to **EXPECTED**, mark PASS/FAIL.

If any isolation/secret/session revocation test fails → **PHASE 2 FAILED**.

### Preconditions (common)

```bash
./scripts/dev-up.sh
cp .env.example .env   # set JWT_SECRET (>=32 chars) for development
./scripts/run-api.sh
pnpm --filter @pvg/web dev      # if web package present
pnpm --filter @pvg/desktop dev  # or tauri:dev
```

Email in development: check API console logs for verification/reset links (`EMAIL_TRANSPORT=console`).

---

### TEST A — Website signup
**TEST ID:** P2-UAT-A  
**PURPOSE:** Real registration works end-to-end.  
**PRECONDITIONS:** API + web running; console email transport.  
**STEPS:** Open `/signup` → enter email/password → submit.  
**EXPECTED:** Account created; pending verification guidance; no stack traces.  
**PASS CONDITION:** Success UX; password not shown in logs.  
**FAIL CONDITION:** Stack traces, plaintext password in logs, or silent failure.

### TEST B — Email verification
**STEPS:** Use verification link from console/email → land on success.  
**EXPECTED:** Email verified; can login. Expired link shows recovery.  
**PASS:** Verified account active.

### TEST C — Login
**STEPS:** Login with verified credentials.  
**EXPECTED:** Session established; dashboard/shell loads. Wrong password → generic error.  
**PASS:** Authenticated shell.

### TEST D — Logout
**STEPS:** Logout.  
**EXPECTED:** Private routes inaccessible; refresh cannot revive without re-login.  
**PASS:** Cleared session.

### TEST E — Password change
**STEPS:** Security → Change password → logout → login with new.  
**EXPECTED:** Old password fails; new works; security notification logged.  
**PASS:** Credential rotated.

### TEST F — Password reset
**STEPS:** Forgot password → use reset link → set new password.  
**EXPECTED:** Token single-use; old password dead; sessions handled per policy.  
**PASS:** Reset secure.

### TEST G — Google login
**STEPS:** Continue with Google (if credentials configured) or verify button opens OAuth URL safely.  
**EXPECTED:** No Google password collected in PVG; cancel handled; no tokens in UI.  
**PASS:** Flow secure (or DEFERRED if GOOGLE_OAUTH_* unset — document).

### TEST H — 2FA enable
**STEPS:** Enable TOTP → scan/verify → logout → login with TOTP.  
**EXPECTED:** MFA required after password.  
**PASS:** Challenge works.

### TEST I — Recovery code
**STEPS:** Use recovery code once; attempt reuse.  
**EXPECTED:** First succeeds; reuse fails. Regenerate invalidates old set.  
**PASS:** One-time codes.

### TEST J — Device registration
**STEPS:** Desktop login → Devices list.  
**EXPECTED:** Current device listed with platform/version.  
**PASS:** Device visible.

### TEST K — Device revocation
**STEPS:** Two sessions/devices → revoke one from web.  
**EXPECTED:** Revoked device cannot refresh.  
**PASS:** Access denied on revoked device.

### TEST L — Sign out all other devices
**STEPS:** Trigger from Security → confirm.  
**EXPECTED:** Other sessions dead; current remains (or as designed with confirmation).  
**PASS:** Others revoked.

### TEST M — Desktop login
**STEPS:** Desktop “Continue in browser” or password login.  
**EXPECTED:** Waiting state → authenticated workspace.  
**PASS:** Desktop authenticated.

### TEST N — Provider connection
**STEPS:** Connections → Connect test provider → enter test key.  
**EXPECTED:** Local vault stores secret; cloud metadata only; UI never shows full key.  
**PASS:** Connected metadata; secret local.

### TEST O — Provider disconnect
**STEPS:** Disconnect.  
**EXPECTED:** Metadata cleared/disconnected; local secret removed; logs clean.  
**PASS:** Disconnected.

### TEST P — Usage/balance
**STEPS:** Open usage for a provider.  
**EXPECTED:** AVAILABLE / UNAVAILABLE / NOT_SUPPORTED — never fake zero.  
**PASS:** Honest status.

### TEST Q — Account settings
**STEPS:** Edit display name; view email.  
**EXPECTED:** Persists; validation errors clear.  
**PASS:** Profile updates.

### TEST R — Subscription view
**STEPS:** Billing → current plan.  
**EXPECTED:** FREE (or assigned) plan + entitlements summary.  
**PASS:** Plan shown from server.

### TEST S — Checkout sandbox
**STEPS:** Upgrade via sandbox checkout if enabled.  
**EXPECTED:** Sandbox completes; subscription/entitlement updates. Live payment not claimed.  
**PASS:** Sandbox works or clearly DEFERRED.

### TEST T — Re-login
**STEPS:** Logout → login.  
**EXPECTED:** Data intact.  
**PASS:** Persistence OK.

### TEST U — Offline
**STEPS:** Disconnect network → attempt cloud op; reconnect.  
**EXPECTED:** Clear offline error; no project wipe; no crash.  
**PASS:** Graceful.

### TEST V — User switching (mandatory)
**STEPS:** Login A → connect provider → logout → Login B → verify A data invisible → logout → Login A → A data intact.  
**EXPECTED:** Full isolation.  
**PASS:** No cross-user leakage.

### TEST W — Cross-user API isolation
**STEPS:** As B, request A's session/device/connection/invoice IDs.  
**EXPECTED:** 401/403/404.  
**PASS:** Denied.

### TEST X — Diagnostics secret safety
**STEPS:** Open diagnostics with a connected provider.  
**EXPECTED:** No API keys/tokens/passwords.  
**PASS:** Clean diagnostics.

---

## Sign-off

| Item | Value |
|------|-------|
| Tester | |
| Date | |
| Automated tests | PASS / FAIL |
| Security / isolation | PASS / FAIL |
| Decision | APPROVE PHASE 2 / REJECT |

**Overall remains PENDING until you explicitly approve.**
