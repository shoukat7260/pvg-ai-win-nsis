# PVG AI Desktop (`@pvg/desktop`)

Phase 1 foundation for **PVG AI / Product Generator AI** — Tauri v2 + React + TypeScript + Vite + Tailwind.

This is a real local workstation shell with narrow native IPC. It does **not** fake AI, media, or authentication features.

## Stack

- Tauri 2.x (Rust)
- React 18 + TypeScript (strict)
- Vite + Tailwind CSS
- Zustand (no secrets in persisted state)
- TanStack Query + Zod
- Vitest + React Testing Library

## Screens

1. Splash  
2. Login placeholder — *Foundation only — authentication arrives in Phase 2*  
3. Main application shell (nav)  
4. Home / foundation (local workspace + project create)  
5. Settings shell  
6. Security shell (vault metadata)  
7. About / Diagnostics  

Nav items Create / Edit / Media / AI / Voice / Templates are visible but **disabled** (“Coming later”).

## Run

From the monorepo root (`/home/projects/PVG AI` — quote the path because of the space):

```bash
cd "/home/projects/PVG AI"
pnpm install
pnpm --filter @pvg/desktop dev          # Vite UI only (browser preview mocks IPC)
pnpm --filter @pvg/desktop test         # Vitest
pnpm --filter @pvg/desktop build        # frontend production build

# Native
cd "/home/projects/PVG AI/apps/desktop/src-tauri"
cargo test
cargo check
cd "/home/projects/PVG AI/apps/desktop"
pnpm tauri:dev                          # full desktop shell
```

Root scripts: `pnpm dev:desktop`, `pnpm build:desktop`.

## Linux system dependencies

Tauri on Linux needs WebKitGTK / GTK development packages. If `cargo check` fails with missing `webkit2gtk-4.1` / `gtk+-3.0`:

See [`SYSTEM_DEPS.md`](./SYSTEM_DEPS.md) for the full package list.

Path / project / IPC unit tests run without GTK via `crates/pvg-core`:

```bash
cd "/home/projects/PVG AI/apps/desktop/src-tauri"
CARGO_TARGET_DIR=/tmp/pvg-desktop-target cargo test -p pvg-core
```

## Native command surface (narrow)

| Command | Purpose |
|---------|---------|
| `ensure_local_workspace` | Bootstrap `PVG/users/local/...` |
| `create_project` / `open_project` / `save_project` / `read_project_metadata` | Project metadata IPC |
| `list_workspace_projects` | List `.pvg` bundles |
| `get_diagnostics` | Safe diagnostics |
| `vault_*` | Metadata / memory vault stubs |
| `emit_progress_stub` | Async progress event pattern |

**Forbidden:** unrestricted shell, `run_any_command`, broad filesystem access. Paths are canonicalized and checked against allowed roots (traversal / UNC rejected).

## Credential vault

`CredentialVault` trait: `store` / `get` / `delete` / `has` / `listMetadata`.  
Phase 1 backend: **in-memory**. OS keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service) is documented for a later phase.
