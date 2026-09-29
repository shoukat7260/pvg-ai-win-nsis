# Billing Security

**Phase:** 2 (sandbox)

- `PAYMENT_PROVIDER=sandbox` only; no live processor.
- Webhooks require `X-PVG-Signature` = HMAC-SHA256 of raw body with `PAYMENT_WEBHOOK_SECRET`.
- Events keyed by `provider_event_id` (unique) for idempotency.
- Plans FREE / CREATOR / PRO / AGENCY seeded with entitlements; subscriptions and invoices are user-scoped with RLS.
- Production fail-closed: webhook secret required when payments enabled.
