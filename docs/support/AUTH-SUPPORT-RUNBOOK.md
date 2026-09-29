# Auth Support Runbook

**Audience:** Support / on-call  
**Rule:** Never ask users for passwords, TOTP secrets, recovery codes in full, refresh tokens, or provider API keys.

---

## Login failure

1. Confirm email verified (`pending_verification` cannot use normal APIs).
2. Confirm account not suspended/disabled.
3. Ask user to retry; check rate-limit (progressive backoff — not permanent lock).
4. Review security activity for `LOGIN_FAILED` bursts.
5. Offer password reset if credential forgotten.

## Email verification failure

1. Check console/SMTP delivery for the environment.
2. Offer resend (rate-limited).
3. If token expired → guide to resend; do not reuse old links.
4. Do not confirm whether an arbitrary email is registered beyond product-safe messaging.

## Password reset

1. Always show generic “if an account exists, email was sent”.
2. Tokens are single-use and short-lived.
3. After reset, old password must fail; sessions follow revoke policy.
4. Never ask the user to paste the reset token into chat.

## 2FA recovery

1. Prefer TOTP app codes.
2. One recovery code per use; remaining count visible in Security settings.
3. Regenerate recovery codes only after strong re-authentication.
4. Support cannot “look up” TOTP secrets.

## Device revocation

1. User: Settings → Devices → Revoke (confirm current device carefully).
2. Revoked device cannot refresh; must sign in again.
3. “Sign out all other devices” leaves current session (with confirmation UX).

## Provider connection issue

1. Secrets are **on the user device**, not in PVG cloud.
2. Support may discuss connection **status/metadata** only.
3. Never request the API key value; ask user to reconnect locally.
4. Device B needs its own connect — keys do not sync across devices by design.

## Subscription mismatch

1. Server entitlements are authoritative (`EntitlementService`).
2. Check subscription status / plan from billing APIs.
3. Sandbox vs live: do not claim live payment if only sandbox is configured.
4. Duplicate webhooks are idempotent; do not manually double-apply events.

## Payment webhook issue

1. Verify webhook signature secret is configured for the environment.
2. Check provider event id uniqueness / processing logs (no card data).
3. Never trust client return URLs as payment confirmation.
