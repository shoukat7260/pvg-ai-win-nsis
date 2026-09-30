# PHASE 4.2D — Windows Release Report (Hotfix)

**STATUS: READY FOR USER ACCEPTANCE**

**WINDOWS MANUAL UAT: PENDING** (human only — not auto-approved)

Updated: 2026-09-29 (login + icon hotfix → installer **0.1.1**)

## 1. Exact root cause of "Failed to fetch"

1. Packaged desktop auth used `VITE_API_PUBLIC_URL` with fallback **`http://localhost:8000`**.
2. The prior Windows release did **not** bake a production API URL, so the installed app called **loopback on the Windows PC**.
3. No PVG API exists on the user’s Windows localhost → WebView `fetch` threw **`Failed to fetch`**.
4. CSP `connect-src` and server CORS only allowed localhost (secondary blockers for WebView-native fetch).

## 2. Production API URL strategy

Central module: `apps/desktop/src/config/desktopApiConfig.ts`

| Environment | API base |
|-------------|----------|
| development / test | `http://127.0.0.1:8000` |
| production (packaged) | `http://62.171.139.173:8000` via `.env.production` + non-localhost default |

Override: `VITE_API_PUBLIC_URL` (production refuses localhost). Dist verified to contain `62.171.139.173:8000`.

## 3. Tauri network / permission changes

- Added `@tauri-apps/plugin-http` / `tauri-plugin-http` for packaged auth requests.
- Capability scope (narrow): `http://127.0.0.1:8000/**`, `http://localhost:8000/**`, `http://62.171.139.173:8000/**`
- CSP `connect-src` includes the VPS origin.
- Backend CORS includes `https://tauri.localhost` (+ related Tauri origins).
- `scripts/run-api.sh` safely loads root `.env` and exports CORS/API URL.

## 4. Backend changes

- CORS origins expanded for Tauri.
- Config loads `../.env` from `services/api`.
- Public health/login reachable at `http://62.171.139.173:8000`.

## 5. Authentication test result (automated / remote)

- Public `POST /api/v1/auth/login` wrong password → `401` invalid credentials.
- OPTIONS `Origin: https://tauri.localhost` → `access-control-allow-origin` present.
- Packaged Windows login: **PENDING human UAT**.

## 6–9. Icons

- Source: `apps/desktop/branding/pvg-mark.svg` (mountain mark, blue/cyan, no tagline).
- Generated: `src-tauri/icons/icon.ico`, `icon.png`, `32x32.png`, `128x128.png`, `@2x`, plus platform variants via `tauri icon`.
- `tauri.conf.json` now includes `icons/icon.ico` in `bundle.icon`.
- Shortcut / taskbar / window icon: **PENDING human UAT** (uninstall old build first to avoid Windows icon cache).

## 10–14. Installer

| Field | Value |
|-------|--------|
| Version | **0.1.1** |
| Build | 6 / run `36635763889` |
| Commit | `7158a9bf44003aa7d28a4a87a5c465b6da5577c1` |
| Path | `artifacts/windows/PVG-AI-Setup-x64.exe` |
| Size | **5,023,908 bytes** |
| SHA-256 | `5ced74048b13e695ab1b9279daab6705fe7677ed7092b7891df77f65256d8216` |
| Browser URL | `/downloads/windows/PVG-AI-Setup-x64.exe` |
| Download verify | **PASS** (`no-store`, SHA match) |

## 15. Automated tests

**PASS** — typecheck; desktop 44 (incl. hotfix); opencut-integration 2; editor-core 17.

## 16. Windows UAT

**PENDING** — see `docs/PHASE-4.2D-WINDOWS-UAT.md` (hotfix checklist H1–H8 + editor smoke).

## 17. Remaining limitations

- Position keyframe bake limited; wipe/slide export limited vs fade.
- Production API is **HTTP** on `:8000` (HTTPS + dedicated domain recommended).

## Final status rule

Ready for human acceptance now. Do **not** mark **PHASE 4.2 RELEASE CANDIDATE ACCEPTED** until packaged Windows UAT passes.
