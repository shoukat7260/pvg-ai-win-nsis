# PVG AI — Security Architecture

**Phase:** 1–3  
**Status:** Phase 1–2 APPROVED; Phase 3 READY FOR USER ACCEPTANCE  
**Principle:** Defense in depth. Never trust client-provided ownership identifiers.

Phase 3 adds: untrusted media import, FFmpeg argv-only processing, path-safe derivatives, LINK-source non-deletion, no secrets in project bundles. See `docs/architecture/MEDIA-ENGINE-ARCHITECTURE.md` and `docs/PHASE-3-INITIAL-AUDIT.md`.

---

## 1. Security Boundaries

| Boundary | Control |
|----------|---------|
| **Authentication** | Session/token identity only (Phase 2 implements flows; Phase 1 defines interfaces + test fixtures) |
| **Authorization** | Service-layer permission checks before any resource mutation |
| **Tenant** | Workspace membership; no global project access |
| **Desktop** | Tauri capabilities narrowly scoped |
| **Native IPC** | Typed commands; path canonicalization; no shell |
| **API** | `/api/v1` contracts; structured errors; rate limits |
| **Database** | RLS + non-superuser app role |
| **Credential** | Vault abstraction; secrets never in PostgreSQL/React/logs |
| **Filesystem** | User-scoped roots; traversal rejection |
| **Logging** | Structured logs + secret redaction |
| **Update** | Future signed updates (documented; not implemented) |
| **Plugin** | Future sandbox boundary (documented; not implemented) |

---

## 2. Identity Authority

Authoritative identity sources:

- Authenticated session / bearer token claims
- Server-side membership lookups

**Not authoritative:**

- `user_id`, `workspace_id`, `owner_id`, `project_id`, `asset_id`, `generation_id` supplied by clients for authorization decisions

---

## 3. Authorization Model Summary

Permissions (conceptual):

- `workspace.read` / `workspace.write` / `workspace.manage_members`
- `project.read` / `project.write` / `project.delete` / `project.export`
- `asset.read` / `asset.write` / `asset.delete`
- `connection.read` / `connection.manage`

Functions:

- `authorize_workspace_access()`
- `authorize_project_access()`
- `authorize_asset_access()`
- `authorize_generation_access()`
- `authorize_provider_connection_access()`

See [AUTHORIZATION-MODEL.md](./AUTHORIZATION-MODEL.md).

---

## 4. Credential Vault Rules

Raw provider secrets must **never** be:

- stored in PostgreSQL
- stored in plaintext config
- stored in localStorage / sessionStorage
- put in URLs, analytics, crash reports, normal logs
- displayed to admins or debug panels

Vault API: `storeCredential`, `getCredential`, `deleteCredential`, `hasCredential`, `listCredentialMetadata`.

Phase 1: abstraction + in-memory/test backend. Production OS-backed store (Windows DPAPI / platform keyring) is the Phase 2+ implementation boundary.

---

## 5. Tauri / IPC Rules

Forbidden:

- unrestricted shell
- arbitrary process execution
- unrestricted filesystem read/write
- `run_any_command(command: string)`

Required for every native command:

1. validate inputs  
2. validate/canonicalize paths  
3. enforce permitted roots  
4. reject traversal  
5. typed errors  
6. no secret leakage  

---

## 6. Secret Redaction

Any log/error/diagnostic payload containing keys matching:

`api_key`, `token`, `access_token`, `refresh_token`, `secret`, `password`, `authorization`, `credential`

must redact values before emission. Automated tests assert `TEST_SECRET_123` never appears in logs.

---

## 7. Rate Limiting

Reusable limiter supporting IP / user / device / endpoint dimensions. Applied to security-sensitive foundation endpoints in Phase 1.

---

## 8. No Backdoors

Forbidden in all environments that can reach production config:

- hidden admin passwords
- universal API keys
- magic tokens
- debug bypass endpoints
- temporary auth bypasses
- secret query parameters
- hardcoded production credentials

Test fixtures activate **only** when `APP_ENV=test`.

---

## 9. Related

- [THREAT-MODEL.md](./THREAT-MODEL.md)
- [AUTHORIZATION-MODEL.md](./AUTHORIZATION-MODEL.md)
