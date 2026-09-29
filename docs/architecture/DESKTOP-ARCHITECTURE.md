# PVG AI — Desktop Architecture

**Phase:** 1  
**Shell:** Tauri v2  
**UI:** React + TypeScript + Vite + Tailwind  
**Native:** Rust

---

## 1. Process Model

```
┌────────────────────────────┐
│  WebView (React UI)        │
│  - foundation screens      │
│  - Zustand app state       │
│  - no unrestricted FS      │
└─────────────┬──────────────┘
              │ invoke() typed commands only
┌─────────────▼──────────────┐
│  Rust Core                 │
│  commands/ filesystem/     │
│  project/ security/        │
│  diagnostics/ errors/      │
└─────────────┬──────────────┘
              │
┌─────────────▼──────────────┐
│  Local storage             │
│  PVG/users/<user-id>/...   │
│  Credential vault (OS)     │
└────────────────────────────┘
```

---

## 2. Capability Separation

| Capability Group | Purpose | Phase 1 |
|------------------|---------|---------|
| UI | Window, events | Enabled |
| Project Files | Scoped project read/write | Narrow commands |
| Media Files | Metadata only | Narrow |
| Native Processing | Future FFmpeg/AI | Interface only |
| Secure Credentials | Vault ops | Abstraction |
| System Integration | Diagnostics | Limited |

**Forbidden:** `run_any_command`, unrestricted FS, unrestricted shell.

---

## 3. IPC Command Surface (Phase 1)

| Command | Validates | Returns |
|---------|-----------|---------|
| `create_project` | name, path roots, user scope | project metadata |
| `open_project` | path under allowed roots | project metadata |
| `read_project_metadata` | project id/path scope | metadata |
| `save_project` | schema validation | ok / typed error |
| `get_diagnostics` | n/a | safe diagnostics |
| `vault_has_credential` | key id | boolean |
| `vault_list_metadata` | scope | metadata only |

Every command:

1. validates inputs (typed)
2. canonicalizes paths
3. enforces allowed roots
4. rejects traversal / UNC / env escapes
5. returns typed errors
6. never logs secrets

---

## 4. Local Workspace Layout

```
PVG/
  users/
    <user-id>/
      projects/
      assets/
      cache/
      backups/
      metadata/
```

Operations are scoped to `CURRENT_USER` / `CURRENT_WORKSPACE` / `CURRENT_PROJECT`.

---

## 5. Frontend Feature Layout

```
src/
  app/           # shell, routing, providers
  components/    # shared UI primitives
  features/
    auth/        # placeholder foundation
    workspace/
    projects/
    settings/
    security/
  services/      # API + native bridges
  state/         # Zustand stores (no secrets)
  lib/
  hooks/
  types/
```

---

## 6. Connectivity Modes

| Mode | Examples |
|------|----------|
| `LOCAL_ONLY` | project browse, local settings, project create |
| `ONLINE_OPTIONAL` | diagnostics refresh against API health |
| `ONLINE_REQUIRED` | authentication (Phase 2), account sync |

UI remains usable offline for local foundations.

---

## 7. Async Native Pattern

Long-running native work must:

- run off the UI thread
- emit progress events
- be cancellable where safe
- never block React renders

Phase 1 establishes the event/progress pattern; heavy engines arrive later.

---

## 8. Foundation Screens

1. Splash  
2. Login placeholder (labeled foundation-only)  
3. Main application shell  
4. Home  
5. Settings shell  
6. Security shell  
7. About / Diagnostics  

Future nav items (`Create`, `Edit`, `AI`, …) are visible but **disabled / coming later**.
