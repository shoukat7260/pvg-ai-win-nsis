# PHASE 4.3 — Full Application Audit

**Date:** 2026-09-30  
**Scope:** Desktop product journey (installer → auth → home → projects → library → editor → export)  
**Status:** Audit complete — implementation in progress  
**Overall readiness:** NOT READY (P0 auth + project open + CapCut shell incomplete)

---

## 1. Current working systems

| System | Evidence |
|--------|----------|
| Tauri v2 desktop shell | `apps/desktop/src-tauri/` |
| React/TS frontend bootstrap | `apps/desktop/src/main.tsx`, `app/App.tsx` |
| FastAPI auth/register/login/refresh | `services/api/app/api/v1/auth.py` |
| Packaged API URL (production) | `VITE_API_PUBLIC_URL` + `desktopApiConfig.ts` → Contabo `:8000` |
| Tauri HTTP plugin + scoped capabilities | `desktopFetch.ts`, `capabilities/default.json` |
| Auth gate + password login UI | `AuthGate.tsx`, `LoginScreen.tsx` |
| MFA + browser PKCE flows (code) | `authStore.ts`, `MfaChallengeScreen.tsx` |
| Local workspace / create project IPC | `ensure_local_workspace`, `create_project` |
| OpenCut-derived timeline chrome | `@pvg/opencut-integration`, `OpenCutTimelinePanel` |
| Editor-core commands (split/delete/etc.) | `@pvg/editor-core` |
| Media import / probe / export IPC | `pvg-media`, ExportModal |
| Settings (account/security/connections) | `features/settings/*` |
| Windows NSIS pipeline | artifacts + builder mirror (0.1.1 shipped) |
| Brand mark / icons | `branding/`, `tauri icon` |

---

## 2. Broken systems (P0)

### 2.1 Packaged Sign-in → “Sign-in failed. Please try again.”

**Root causes (stacked):**

1. **Session vault write can abort login.** After a successful `/auth/login`, `authStore.loginWithPassword` awaits `vaultService.storeSessionRefresh`. Tauri invoke failures reject with a **string/object**, not `Error` / `ApiClientError` → `toSafeAuthError` falls through to the generic **“Sign-in failed. Please try again.”** even when credentials were valid.
2. **Session restore cannot read refresh token.** `store_session_refresh` / `clear_session_refresh` exist, but **no `get_session_refresh` IPC**. `bootstrap()` only calls `/me` when an in-memory access token exists → every relaunch forces login.
3. **Login response has no user object.** API `LoginResponse` returns tokens only; client always calls `getMe()`. Any post-login failure (vault or `/me`) surfaces as login failure.
4. **Account state (observed):** user `muhammadafzalkhanbaloch786@gmail.com` was `pending_verification` (login still allowed by backend). Verified manually for diagnosis (`status=active`).
5. **Production “Create account” URL broken:** `.env.production` sets `VITE_WEB_ORIGIN=http://localhost:5173`.

**Auth failure path:**

```
Desktop LoginScreen
  → authStore.loginWithPassword
  → getApiClientAsync (plugin-http)
  → POST /api/v1/auth/login
  → adaptLoginResult (tokens)
  → setAccessToken
  → vault.storeSessionRefresh  ← may throw non-Error
  → getMe()
  → AUTHENTICATED | catch → toSafeAuthError
```

### 2.2 “Could not open project” / “Unknown error”

**Path:**

```
Home setProject + navigate(/app/edit)
  → EditorWorkspace useEffect
  → editorStore.openDocument(path)
  → load_project_document (NOT open_project)
  → loadProject + migrate + ensureEditorTracks
  → on catch: loadError message
  → UI: "Could not open project" + message || "Unknown error"
```

**Issues:**

- `loadAttemptRef` blocks retry after failure without remount.
- No stage diagnostics (resolve → read → validate → migrate → media → mount).
- `open_project` IPC unused by UI.
- Missing media can fail the whole open instead of relink UX.
- No Retry / Back to Home actions.

---

## 3. Partial / incomplete systems

| Area | Status | Notes |
|------|--------|-------|
| App shell nav | PARTIAL | Home/Edit/Media/Settings/About only; Create/AI/Templates disabled stubs |
| Home | PARTIAL | Phase 3 copy; create+list only; web-dashboard aesthetic |
| Projects hub | MISSING | No `/app/projects` |
| Library | MISSING | No CapCut-class library |
| Templates | MISSING | |
| AI workspace chatbot | MISSING | Copilot lives inside editor RightDock (wrong placement for Phase 4.3) |
| In-app signup | MISSING | Web only |
| Forgot password (desktop) | MISSING | |
| Onboarding | MISSING | |
| Project thumbnails | PARTIAL | Media thumbnails exist; project cards weak |
| OpenCut full NLE | PARTIAL | Zoom/ruler + PVG commands; not full EditorCore/WASM monitor |
| Export | WORKING (desktop) | UI admits compositing limits |
| Installer storytelling | PARTIAL | Functional NSIS; CapCut-class slides not yet original PVG art |
| Session restore | BROKEN | See §2.1 |

---

## 4. Obsolete / replace

- `LoginPlaceholder.tsx` — unused Phase 2 stub
- `features/security/SecurityShell.tsx` — unrouted vault demo
- WorkspaceHome “Phase 3 · Media foundation” / “no timeline editor yet”
- Preferences copy claiming Edit is future
- Light SaaS split-auth shell as long-term product chrome (keep functional auth; restyle CapCut-class)
- Dual unused `projectService.open` path vs `load_project_document`

---

## 5. Frontend systems to replace (shell)

Replace weak shell with CapCut-class domains:

```
desktop/src/
  shell/          # dark creative app chrome
  auth/           # login, signup, restore (keep secure vault)
  home/
  projects/
  library/
  templates/
  ai/             # workspace chatbot (outside editor)
  settings/
  editor/         # OpenCut-backed NLE chrome rebuild
  export/
  shared/         # design tokens, toasts, empty states
```

Preserve: security, vault, editor-core, opencut-integration, media engine, project format, Tauri capabilities.

---

## 6. Missing pages / components

- Signup (desktop)
- Onboarding wizard
- Projects grid/list + trash
- Library browser (projects/videos/images/audio/generated/exports/favorites/trash)
- Templates gallery
- AI workspace (primary chatbot)
- New project dialog (polished presets)
- Global search (Ctrl+K) beyond editor palette
- Professional shortcuts settings UI
- Installer feature slides (original PVG)
- Startup splash with real phases
- Project open diagnostics + media relink

---

## 7. Routing problems

| Route | Issue |
|-------|-------|
| `/app/projects` | Missing |
| `/app/library` | Missing |
| `/app/templates` | Missing |
| `/app/ai` | Missing |
| `/app/create` | Missing |
| `/login` | Redirect only; signup not first-class |
| Catch-all `*` | Hard reset to splash — loses deep links |

Editor correctly skips AppShell (`/app/edit`).

---

## 8. State ownership problems

- Local foundation user overwritten by auth identity inconsistently (`WorkspaceHome` bootstrap still sets “Local Foundation User”).
- Project selection lives in `appStore`; editor load in `editorStore` — desync if path invalid.
- Refresh token in vault with no read path → status UNKNOWN→UNAUTHENTICATED always after restart.
- AI Copilot in editor inspector conflicts with Phase 4.3 “chatbot outside editor”.

---

## 9. Editor shortcomings (vs CapCut-class)

- Density / dark chrome inconsistent with light workspace shell
- Effects/transitions/text browsers not CapCut-class thumbnail grids with guaranteed real mutations for all listed categories
- Keyframe graph UI not production-complete (must not overclaim)
- AI Copilot default-right-dock obstructs inspector
- Program monitor OK but not maximize/workspace presets complete
- Error UX for open failure inadequate

---

## 10. Production configuration checklist

| Item | Status |
|------|--------|
| Packaged API → Contabo (not localhost) | PASS (after 4.2D hotfix) |
| CSP connect-src includes API | PASS |
| HTTP capability scope | PASS |
| `VITE_WEB_ORIGIN` production | **FAIL** → localhost:5173 |
| HTTPS API | Not available (HTTP documented limitation) |
| Session restore | **FAIL** |
| Windows UAT 0.1.1 | PENDING |

---

## 11. Priority for implementation (Phase 4.3)

**P0:** Auth (vault non-fatal + get refresh + bootstrap restore + signup + error copy) · Project open diagnostics/retry · Shell routes  
**P1:** Home · Projects · Media · Timeline · Preview · Save/reopen · Export  
**P2:** Text/Audio/Effects/Transitions/Captions  
**P3:** Templates · Library · AI workspace · UGC entry  
**P4:** Installer art · polish  

---

## 12. Screenshot reference (UX only — no CapCut assets)

Supplied CapCut screenshots used for IA density only: installer storytelling, home create+projects, editor quadrants, export modal, shortcuts density. PVG must use original branding/assets.

---

**Audit complete. Visual rebuild may proceed with P0 auth fixes landing first.**
