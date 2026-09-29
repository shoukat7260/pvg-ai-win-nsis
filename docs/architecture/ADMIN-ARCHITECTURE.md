# PVG AI — Admin Architecture (Foundation Only)

**Phase 1 status:** Architecture documentation only. No admin UI implementation.

## Future Modules

| Module | Purpose | Credential rule |
|--------|---------|-----------------|
| Users | Account lookup, status | No provider secrets |
| Subscriptions | Plan metadata | No payment PAN storage here |
| Payments | Billing ops (later) | PCI deferred; no secrets in admin UI |
| Content | Platform content/CMS | N/A Phase 1 |
| Analytics | Aggregate metrics | No private project media |
| Security | Security events review | Redacted metadata only |
| Support | Ticket context | No vault secret reveal |

## Hard Rule

Admins must **not** see raw BYOK provider secrets by default (or at all in Phase 1 design). Vault secrets remain on the user device.
