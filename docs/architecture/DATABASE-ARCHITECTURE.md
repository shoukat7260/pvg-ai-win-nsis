# PVG AI — Database Architecture

**Phase:** 1 + 2 (`001_initial_schema`, `002_phase2_identity_billing`)  
**Engine:** PostgreSQL 16  
**ORM:** SQLAlchemy 2.x  
**Migrations:** Alembic

Phase 2 adds identity/session/MFA/token tables, provider usage snapshots, and billing catalog (plans, subscriptions, entitlements, payments, webhooks idempotency). Do not edit applied migrations — add new ones.
---

## 1. Identifier Strategy

- Public identifiers: **UUID v4** (never sequential integers).
- Internal surrogate keys may exist only if never exposed; Phase 1 uses UUID PKs throughout.
- Soft-delete via `deleted_at` (nullable timestamptz) on tenant-owned entities.

---

## 2. Core Entities

### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| email | CITEXT/TEXT | unique |
| normalized_email | TEXT | unique, lowercased |
| display_name | TEXT | |
| status | ENUM | `active`, `disabled`, `pending` |
| email_verified_at | TIMESTAMPTZ | nullable |
| password_hash | TEXT | nullable in Phase 1; never plaintext |
| created_at / updated_at / last_login_at | TIMESTAMPTZ | |

### workspaces
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | TEXT | |
| type | ENUM | `personal`, `client`, `agency`, `team` |
| owner_id | UUID FK → users | |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | |

### workspace_members
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK | |
| user_id | UUID FK | |
| role | ENUM | OWNER/ADMIN/EDITOR/CREATOR/REVIEWER/VIEWER |
| created_at | TIMESTAMPTZ | |
| UNIQUE(workspace_id, user_id) | | |

### projects
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| workspace_id | UUID FK | required — never global |
| name | TEXT | |
| schema_version | INT | cloud metadata mirror |
| status | ENUM | `active`, `archived` |
| created_by | UUID FK → users | |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | |
| version | INT | optimistic concurrency |

### project_members
Membership for collaboration foundation (roles subset of workspace roles).

### assets
Workspace/project-scoped metadata records (not binary blobs).

### generation_jobs
Future generation tracking foundation (status enum, provider_type, ownership).

### provider_connections
Metadata only — **no raw secrets**. Secrets live in local CredentialVault.

### devices / sessions
Device registration and session foundation for Phase 2 auth.

### audit_logs / security_events
Append-oriented security observability foundations.

---

## 3. Ownership Rules

1. Every project **must** belong to a workspace.
2. Every asset/generation/connection must be reachable through workspace membership.
3. Client-provided ownership IDs are **never** authoritative.
4. Service layer checks membership **before** mutation.
5. RLS enforces the same boundary at the database layer.

---

## 4. Row Level Security

### Roles

| Role | Purpose |
|------|---------|
| `pvg_migrator` | Owns tables; runs Alembic; bypasses RLS |
| `pvg_app` | Application connections; **subject to RLS** |

### Session context

Application sets (per transaction/request):

```sql
SELECT set_config('app.current_user_id', '<uuid>', true);
SELECT set_config('app.current_workspace_ids', '<csv-uuids>', true);
```

### Policy pattern (projects example)

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON projects
  FOR SELECT
  USING (
    workspace_id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
  );
```

Similar policies apply to workspaces, assets, generation_jobs, provider_connections.

### Pooling note

With PgBouncer transaction pooling, `set_config(..., true)` (transaction-local) is required. Do not rely on session-level GUC across pooled connections.

### Defense in depth

RLS is **not** the only control. Authorization service must also deny unauthorized access. Tests cover both layers independently.

---

## 5. Indexes & Integrity

- Unique: `users.normalized_email`, `(workspace_members.workspace_id, user_id)`
- FK indexes on all ownership columns
- Partial indexes on `deleted_at IS NULL` for active lookups
- CHECK constraints on enums / non-empty names

---

## 6. Migrations

- Alembic revision chain under `services/api/alembic/`
- Initial migration creates tenant + security tables + RLS policies + roles grants
- Tests: fresh DB migrate + verify RLS isolation

---

## 7. What Is Not Stored in PostgreSQL

- Raw API keys / provider secrets
- Local media binaries
- Timeline binary caches
- Password plaintext
