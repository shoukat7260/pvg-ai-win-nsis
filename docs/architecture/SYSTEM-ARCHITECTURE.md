# PVG AI — System Architecture

**Phase:** 1–3  
**Status:** Phase 1–2 APPROVED; Phase 3 READY FOR USER ACCEPTANCE  
**Principle:** Local-first creative workstation with a lightweight cloud control plane.

Phase 3 adds the local media engine (`pvg-media`), project schema v2, import/proxy/preview foundations, and job system. Timeline editing remains Phase 4. See `docs/PHASE-3-IMPLEMENTATION.md`.

---

## 1. High-Level Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER MACHINE                            │
│  ┌──────────────┐   IPC (scoped)   ┌─────────────────────────┐ │
│  │  PVG Web UI  │◄────────────────►│  Rust Native Engine     │ │
│  │  (React/TS)  │                  │  - project format       │ │
│  │  Desktop app │                  │  - path validation      │ │
│  │  via Tauri   │                  │  - credential vault     │ │
│  └──────┬───────┘                  │  - diagnostics          │ │
│         │ HTTPS (optional)         │  - future: FFmpeg/AI    │ │
│         │                          └───────────┬─────────────┘ │
│         │                                      │               │
│         │                          ┌───────────▼─────────────┐ │
│         │                          │ Local Filesystem        │ │
│         │                          │ PVG/users/<id>/...      │ │
│         │                          │ *.pvg project bundles   │ │
│         │                          └─────────────────────────┘ │
└─────────┼──────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         PVG CLOUD                               │
│  ┌──────────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐ │
│  │  PVG API     │  │ PostgreSQL │  │  Redis   │  │  Admin   │ │
│  │  (FastAPI)   │──│ + RLS      │  │ (jobs/   │  │ (future) │ │
│  │  /api/v1     │  │ multi-     │  │  rate)   │  │          │ │
│  └──────────────┘  │ tenant     │  └──────────┘  └──────────┘ │
│                    └────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼ (future phases — BYOK / provider adapters)
┌─────────────────────────────────────────────────────────────────┐
│                       AI PROVIDERS                              │
│  ElevenLabs · Google/Veo · Runway · Kling · fal.ai · others    │
│  (generation + provider billing — never PVG-owned media store) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Responsibility Boundaries

### USER MACHINE (authoritative for creative work)

| Concern | Location |
|---------|----------|
| Media files | Local filesystem |
| Project files (`.pvg`) | Local filesystem |
| Local cache / proxies / thumbnails | Local filesystem |
| Local credentials (BYOK secrets) | OS-protected vault |
| Local rendering (future FFmpeg) | Native engine |
| Local AI processing (future Whisper, etc.) | Native engine |
| Timeline / preview state | Local app state + project metadata |
| Device diagnostics | Local + optional cloud health |

### PVG CLOUD

| Concern | Location |
|---------|----------|
| Identity & authentication | API + PostgreSQL |
| Account / subscription / licensing metadata | PostgreSQL |
| Device sessions | PostgreSQL |
| Workspace / project **metadata** (when sync enabled) | PostgreSQL |
| Usage metadata | PostgreSQL |
| Platform configuration / feature flags | PostgreSQL + config |
| Audit & security events | PostgreSQL |
| Support / admin tooling | Future admin app |
| Rate limiting coordination | Redis abstraction |

### AI PROVIDERS

| Concern | Location |
|---------|----------|
| Actual generation | Provider APIs |
| Provider billing / quotas | Provider accounts |
| Raw model compute | Provider infrastructure |

**Never blur:** PVG Cloud must not become the render farm. Media truth stays local unless the user explicitly opts into future sync.

---

## 3. Application Surfaces

| Surface | Phase 1 | Role |
|---------|---------|------|
| **PVG Desktop** | Implemented foundation | Primary creative workstation |
| **PVG Web** | Scaffold only | Future browser companion / marketing shell |
| **PVG Admin** | Architecture docs only | Platform ops (users, security, support) |
| **PVG API** | Implemented foundation | Auth/metadata/platform services |
| **AI Provider Layer** | Interfaces only | Connect/disconnect/status contracts |

---

## 4. Data Flow Principles

1. **Authenticated identity** comes from the session/token — never from client-supplied `user_id` / `workspace_id` / `owner_id`.
2. **Authorization** is enforced in the API service layer **and** PostgreSQL RLS.
3. **Secrets** never leave the credential vault into React state, logs, or PostgreSQL.
4. **Project metadata** in `.pvg/project.json` is the local source of truth for creative structure.
5. **Cloud project rows** are metadata indexes / sync hooks — not media storage.
6. Heavy native work must be async with progress events (UI thread never blocked).

---

## 5. Multi-Tenant Model

```
User ──membership──► Workspace ──owns──► Project ──owns──► Asset
                           │                  │
                           └──roles──►        └── GenerationJob
```

Roles (foundation): `OWNER`, `ADMIN`, `EDITOR`, `CREATOR`, `REVIEWER`, `VIEWER`.

Isolation rule: User A in workspace A must not read/write User B resources even when IDs are known (IDOR protection).

---

## 6. Extension Points (Later Phases)

| Interface | Phase 1 Status | Future Use |
|-----------|----------------|------------|
| `CredentialVault` | Abstraction + test impl | OS keychain / DPAPI |
| `ProviderAdapter` | Types + no network | ElevenLabs, Veo, etc. |
| `RenderEngine` | Interface stub | Local FFmpeg pipeline |
| `LocalAiEngine` | Interface stub | Whisper, bg removal |
| `JobQueue` | Redis abstraction | Generation queues |
| `PluginHost` | Documented boundary | Marketplace plugins |

---

## 7. Configuration Environments

`development` · `test` · `staging` · `production`

Production **fails closed** if required secrets are missing. No insecure silent defaults.

---

## 8. Related Documents

- [DATABASE-ARCHITECTURE.md](./DATABASE-ARCHITECTURE.md)
- [DESKTOP-ARCHITECTURE.md](./DESKTOP-ARCHITECTURE.md)
- [../security/SECURITY-ARCHITECTURE.md](../security/SECURITY-ARCHITECTURE.md)
- [../project-format/PROJECT-FORMAT.md](../project-format/PROJECT-FORMAT.md)
