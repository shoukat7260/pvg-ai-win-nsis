# PVG AI — Test Strategy

Phase 2 extends this with auth, session, MFA, OAuth, device, provider-secret, billing sandbox, and Phase 1 regression suites. Run API pytest **alone** against Docker Postgres (`:5444`) — concurrent pytest processes cause schema truncate deadlocks.

## Layers

| Layer | Tools | Scope |
|-------|-------|-------|
| Unit | Vitest, Pytest, cargo test | schema, validation, authz, redaction, paths, config, vault |
| Integration | Pytest + test DB | migrations, ownership, authz, RLS, auth/session/MFA |
| Security | Pytest + cargo | IDOR, privilege, path traversal, secret leak, OAuth/PKCE |
| Frontend | Vitest + RTL | shell, nav, settings, auth forms, errors, loading |
| E2E | Playwright (web smoke) | health + foundation flows where applicable |
| Build | CI | typecheck, lint, package |
| Manual UAT | `docs/PHASE-2-USER-ACCEPTANCE.md` | human sign-off gate |

## Tenant Fixtures

Two isolated tenants in **test env only**:

- `security-test-user-a` → workspace_a → project_a → asset_a
- `security-test-user-b` → workspace_b → project_b → asset_b

Never activate in production.

## Gates Before User Acceptance

1. frontend tests  
2. backend tests  
3. Rust tests  
4. integration tests  
5. security tests  
6. migration tests  
7. build checks  
8. lint/typecheck  
9. desktop build  
10. clean env verification  

## Failure Policy

Cross-user visibility, unauthorized mutation, secret in logs, FS escape, unsafe crash on corrupt project, insecure prod defaults, arbitrary shell IPC, or failed RLS/authz tests ⇒ **PHASE 1 FAILED**.
