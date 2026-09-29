# Third-party licenses

## OpenCut Classic

- **Component:** OpenCut editor foundation (timeline, preview, Rust/WASM compositor source)
- **Upstream:** https://github.com/OpenCut-app/opencut-classic
- **Version / commit:** `cf5e79e919144200294fb9fed22a222592a0aeea` (2025-2026 OpenCut)
- **License:** MIT — see [vendor/opencut-classic/LICENSE](vendor/opencut-classic/LICENSE)
- **Integrated in PVG AI:**
  - Vendored reference tree: `vendor/opencut-classic/`
  - Adapted modules & adapters: `packages/opencut-integration/`
  - PVG workspace shell, media security, auth, AI Copilot: `apps/desktop/`
- **Modified areas:** Timeline zoom/ruler utilities adapted under `packages/opencut-integration/src/timeline/` (MIT notice preserved in file headers). Full React editor UI is integrated incrementally via PVG wrappers — not a separate iframe application.

Copyright 2025-2026 OpenCut — MIT License (retained in upstream vendor copy).

## opencut-wasm (npm)

- **Package:** `opencut-wasm` (published from OpenCut Rust WASM build)
- **Use in PVG:** Timeline timebase constants and future compositor init
- **License:** Same MIT lineage as OpenCut Classic (verify package `LICENSE` on install)
