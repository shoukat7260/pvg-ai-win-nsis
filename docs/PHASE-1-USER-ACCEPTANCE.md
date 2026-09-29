# PHASE 1 — User Acceptance Test Plan

**Product:** PVG AI (Product Generator AI)  
**Phase status:** PENDING USER ACCEPTANCE  
**Do not mark Phase 1 complete until every critical test passes and you explicitly approve.**

---

## How to use this document

For each test: perform the **Action**, compare to **Expected**, then mark PASS or FAIL.

If any security test (N–R, X) fails → **PHASE 1 = FAILED**. Fix before approval.

---

### TEST 01 — Launch (A)

**Action:** Start PVG AI desktop (`pnpm --filter @pvg/desktop tauri dev` or packaged binary).  
**Expected:** Application opens without crash; splash then shell appears.  
**PASS:** Window opens, no fatal error dialog.  
**FAIL:** Crash, blank hang >60s, or uncaught fatal error.

### TEST 02 — Branding (B)

**Action:** Observe first screens.  
**Expected:** “PVG AI” / “Product Generator AI” branding is visible and professional — not a generic admin dashboard.  
**PASS:** Brand is hero-level or clearly primary; creative workstation look.  
**FAIL:** Generic template look; missing brand name.

### TEST 03 — Desktop shell (B/C)

**Action:** Enter main shell after splash/login placeholder.  
**Expected:** Navigation shell with Home and foundation sections.  
**PASS:** Shell usable; layout stable on resize.  
**FAIL:** Broken layout or missing shell chrome.

### TEST 04 — Navigation (C)

**Action:** Click Home, Settings, Security, About/Diagnostics. Hover disabled items (Create/Edit/AI…).  
**Expected:** Foundation routes work; future items disabled with “Coming later” (not fake working AI).  
**PASS:** Navigates correctly; no fake AI actions succeed.  
**FAIL:** Dead foundation links or fake AI pretending to work.

### TEST 05 — Settings (D)

**Action:** Open Settings shell.  
**Expected:** Settings foundation visible; no secrets shown.  
**PASS:** Settings opens; no API keys/tokens displayed.  
**FAIL:** Crash or secrets visible.

### TEST 06 — Diagnostics (E)

**Action:** Open About/Diagnostics.  
**Expected:** Version, OS/arch, environment, API/DB/Redis/local storage/native status (as available). No secrets.  
**PASS:** Safe diagnostics shown; `TEST_SECRET` / API keys absent.  
**FAIL:** Secrets or private project contents shown.

### TEST 07 — Local workspace (F)

**Action:** Create a local test workspace via foundation workflow.  
**Expected:** Workspace appears in local UI scoped to current user.  
**PASS:** Workspace created and listed.  
**FAIL:** Error without clear message, or cross-user visibility.

### TEST 08 — Project creation (G)

**Action:** Create a local test project.  
**Expected:** Project metadata created under user-scoped storage / `.pvg` layout.  
**PASS:** Project appears on Home.  
**FAIL:** Creation fails silently or writes outside allowed roots.

### TEST 09 — Project persistence (H)

**Action:** Create project → quit app → relaunch.  
**Expected:** Project metadata still present.  
**PASS:** Project survives restart.  
**FAIL:** Data lost without explanation.

### TEST 10 — Project validation (I)

**Action:** Open a valid project.  
**Expected:** Loads successfully.  
**PASS:** Metadata readable.  
**FAIL:** Valid project rejected.

### TEST 11 — Invalid project handling (J)

**Action:** Point the app at intentionally corrupted `project.json` (invalid JSON / wrong schema version).  
**Expected:** Clear diagnostic error; no crash; project not auto-deleted.  
**PASS:** Typed/safe error; app remains usable.  
**FAIL:** Crash, silent ignore, or destructive delete.

### TEST 12 — Backend health (K)

**Action:** With Docker services up (`./scripts/dev-up.sh`), run `curl http://localhost:8000/health`.  
**Expected:** Healthy application status JSON (no secrets).  
**PASS:** 200 with status fields.  
**FAIL:** 5xx or secret leakage.

### TEST 13 — Database health (L)

**Action:** `curl http://localhost:8000/ready` with Postgres on host port **5444**.  
**Expected:** Reports database availability distinctly.  
**PASS:** Ready when Postgres up; not-ready when down.  
**FAIL:** Always ready regardless of DB.

### TEST 14 — Redis health (M)

**Action:** Inspect `/ready` with Redis on host port **6480** up/down.  
**Expected:** Redis status reflected.  
**PASS:** Distinct Redis signal.  
**FAIL:** Redis never checked.

### TEST 15 — Authorization behavior (N)

**Action:** As test user A, request allowed workspace A resource via API.  
**Expected:** Allowed.  
**PASS:** 200 for owned resource.  
**FAIL:** Denied incorrectly.

### TEST 16 — Tenant isolation (O)

**Action:** As user A, request user B workspace/project IDs.  
**Expected:** ACCESS DENIED (403/404).  
**PASS:** Denied.  
**FAIL:** Any B data returned.

### TEST 17 — Project isolation (P)

**Action:** User A tries read/update/delete of project B via URL, query, and JSON body ID manipulation.  
**Expected:** All denied.  
**PASS:** All attempts fail.  
**FAIL:** Any succeed.

### TEST 18 — Human IDOR security test (mandatory)

**Action:** Using API client or curl with test auth header (test env only):

1. Authenticate as user A.  
2. Attempt `GET /api/v1/projects/{project_b_id}`.  
3. Attempt update/delete with B’s IDs in URL.  
4. Attempt same with IDs in query string and JSON body.

**Expected:** ACCESS DENIED every time.  
**PASS:** All denied; no B payload fields returned.  
**FAIL:** Any cross-tenant success → PHASE 1 FAILED.

### TEST 19 — Filesystem path safety (Q)

**Action:** Run security lab / Rust path tests; or attempt open with `../../etc/passwd` style paths via IPC if exposed in lab.  
**Expected:** Rejected.  
**PASS:** Traversal rejected.  
**FAIL:** Escape succeeds.

### TEST 20 — Secret redaction (R)

**Action:** Run `./scripts/security-lab.sh` or unit tests for redaction with `TEST_SECRET_123`.  
**Expected:** Secret never appears in logs/diagnostics.  
**PASS:** Tests pass; manual log skim clean.  
**FAIL:** Secret visible → PHASE 1 FAILED.

### TEST 21 — Log safety (S)

**Action:** Trigger an error involving a fake token field; inspect logs.  
**Expected:** Redacted values only.  
**PASS:** No raw secrets.  
**FAIL:** Raw secret logged.

### TEST 22 — Application restart (T)

**Action:** Restart desktop after local project create.  
**Expected:** Stable relaunch + persistence (see TEST 09).  
**PASS:** Clean restart.  
**FAIL:** Crash loop.

### TEST 23 — Clean build (U)

**Action:** `pnpm --filter @pvg/desktop build` and `cargo check` in `src-tauri`.  
**Expected:** Build succeeds.  
**PASS:** Exit 0.  
**FAIL:** Build errors.

### TEST 24 — Test suite (V)

**Action:** `./scripts/run-all-tests.sh` with Postgres/Redis running.  
**Expected:** All suites pass.  
**PASS:** Script reports PASS.  
**FAIL:** Any failing suite.

### TEST 25 — Production configuration sanity (W)

**Action:** Start API with `APP_ENV=production` and empty `JWT_SECRET`.  
**Expected:** Startup fails safely (no insecure default).  
**PASS:** Process refuses to start.  
**FAIL:** Starts with empty/insecure secret.

### TEST 26 — No fake/bypass security (X)

**Action:** Search codebase / try magic query params / debug bypass routes in production config.  
**Expected:** No production backdoors; test auth header rejected when `APP_ENV!=test`.  
**PASS:** No bypass.  
**FAIL:** Bypass exists → PHASE 1 FAILED.

---

## Sign-off

| Item | Value |
|------|-------|
| Tester name | |
| Date | |
| Automated tests | PASS / FAIL |
| Security tests | PASS / FAIL |
| Manual tests | PASS / FAIL |
| Decision | APPROVE PHASE 1 / REJECT |

**Overall remains `WAITING FOR USER ACCEPTANCE` until you explicitly approve.**
