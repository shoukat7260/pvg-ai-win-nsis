# OpenCut integration baseline

| Field | Value |
|--------|--------|
| Repository | https://github.com/OpenCut-app/opencut-classic |
| Commit SHA | `cf5e79e919144200294fb9fed22a222592a0aeea` |
| Branch at clone | default (main) |
| License | MIT |
| Vendor path | `vendor/opencut-classic/` |
| Package manager (upstream) | Bun + Turbo |
| PVG integration package | `@pvg/opencut-integration` |
| PVG fork ownership | PVG maintains adapters + `@pvg/editor-core` as canonical; classic tree is pinned reference |
| Future sync | Diff against pinned SHA manually; no auto-merge from OpenCut rewrite until API stable |

## Upstream layout (reference)

- `apps/web/` — Next.js 16 editor UI, `EditorCore`, timeline React components, preview/renderer
- `rust/wasm/` — compositor, effects, masks (published as `opencut-wasm`)
- `rust/crates/` — time, compositor, gpu, effects, bridge

## PVG build commands (Phase 4.2)

```bash
pnpm install
pnpm --filter @pvg/opencut-integration test
pnpm --filter @pvg/desktop test
pnpm --filter @pvg/desktop typecheck
pnpm --filter @pvg/desktop tauri:build   # production desktop
```

OpenCut upstream builds (development reference only):

```bash
cd vendor/opencut-classic
bun install
bun run build:wasm
bun run dev:web
```

Production PVG **does not** require a local Next.js server.
