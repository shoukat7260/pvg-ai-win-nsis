# PHASE 3 — User Acceptance Test Plan

**Product:** PVG AI  
**Phase:** 3 — Media / project foundation  
**Status:** PENDING USER ACCEPTANCE (do not auto-approve)

Use a test copy of media files. Prefer non-copyrighted / synthetic clips.

### Common preconditions

```bash
./scripts/dev-up.sh
cp .env.example .env
./scripts/run-api.sh
pnpm --filter @pvg/desktop tauri:dev   # or: pnpm --filter @pvg/desktop dev (browser preview)
```

FFmpeg/ffprobe recommended on PATH for probe/thumbnail/proxy. Without them, expect safe “engine unavailable” messages — not crashes.

---

### TEST P3-A — Launch
**PURPOSE:** App opens.  
**STEPS:** Start PVG desktop.  
**EXPECTED:** Branded shell; no crash.  
**PASS:** Opens. **FAIL:** Crash/blank fatal error.

### TEST P3-B — Login
**PURPOSE:** Phase 2 auth still works.  
**STEPS:** Sign in.  
**EXPECTED:** Authenticated shell.  
**PASS:** Home loads. **FAIL:** Auth broken.

### TEST P3-C — Create project
**PURPOSE:** Real project bundle.  
**STEPS:** Home → create project (pick Landscape preset if shown) → create.  
**EXPECTED:** `.pvg` bundle with `project.json` schema v2.  
**PASS:** Project listed/openable. **FAIL:** No bundle / corrupt JSON.

### TEST P3-D — Rename project
**PURPOSE:** Safe rename UX.  
**STEPS:** Rename display name if UI offers; else note DEFERRED if only create-time name.  
**EXPECTED:** Illegal names rejected (`..`, `/`, reserved).  
**PASS:** Safe behavior. **FAIL:** Path escape or crash.

### TEST P3-E — Save
**PURPOSE:** Persist.  
**STEPS:** Make a change (import or settings) → save/autosave.  
**EXPECTED:** `project.json` updates; no wipe.  
**PASS:** Reopen shows change. **FAIL:** Data loss.

### TEST P3-F — Close / reopen
**PURPOSE:** Restore state.  
**STEPS:** Close project/app → reopen project.  
**EXPECTED:** Same assets/settings.  
**PASS:** Intact. **FAIL:** Missing data.

### TEST P3-G — Import video
**PURPOSE:** Real asset.  
**STEPS:** Media → Import → choose MP4 (LINK).  
**EXPECTED:** Asset appears; metadata when FFmpeg present.  
**PASS:** Asset READY/PROCESSING. **FAIL:** Crash / silent no-op.

### TEST P3-H — Import multiple
**PURPOSE:** Multi-select.  
**STEPS:** Import video + image + audio.  
**EXPECTED:** Supported files listed.  
**PASS:** All appear. **FAIL:** Partial unexplained loss.

### TEST P3-I — Unsupported file
**PURPOSE:** Safe rejection.  
**STEPS:** Import `.exe` or random `.bin`.  
**EXPECTED:** Clear unsupported/error; app stable.  
**PASS:** Safe error. **FAIL:** Crash.

### TEST P3-J — Preview
**PURPOSE:** Source monitor.  
**STEPS:** Select video → Play/Pause/Seek.  
**EXPECTED:** Playback controls work (browser/Tauri).  
**PASS:** Plays. **FAIL:** Freeze/crash.

### TEST P3-K — Thumbnail
**PURPOSE:** Derived poster.  
**STEPS:** Generate thumbnail (auto or action).  
**EXPECTED:** Thumbnail when engine available.  
**PASS:** Image shown or honest engine error. **FAIL:** Source overwritten.

### TEST P3-L — Waveform
**PURPOSE:** Audio peaks.  
**STEPS:** Import audio → generate waveform.  
**EXPECTED:** Waveform data/UI or honest failure.  
**PASS:** No source mutation. **FAIL:** Source deleted/corrupt.

### TEST P3-M — Proxy
**PURPOSE:** Edit proxy.  
**STEPS:** Generate proxy (1/4).  
**EXPECTED:** Proxy READY; source untouched.  
**PASS:** Status READY / retryable fail. **FAIL:** Source changed.

### TEST P3-N — Proxy/Original switch
**PURPOSE:** Preview source.  
**STEPS:** Toggle Auto/Proxy/Original.  
**EXPECTED:** Selector changes preview source when files exist.  
**PASS:** Switches. **FAIL:** Wrong file / crash.

### TEST P3-O — Cancel proxy
**PURPOSE:** Cooperative cancel.  
**STEPS:** Start proxy on larger file → Cancel.  
**EXPECTED:** Job CANCELLED; source intact; no fake COMPLETED partial.  
**PASS:** Clean cancel. **FAIL:** Source loss.

### TEST P3-P — Retry
**PURPOSE:** Recoverable retry.  
**STEPS:** Fail an operation (e.g. missing ffmpeg) → install/fix → Retry.  
**EXPECTED:** Retry works when recoverable.  
**PASS:** Succeeds or clear permanent error. **FAIL:** Infinite spin.

### TEST P3-Q — Remove from project
**PURPOSE:** Reference removal.  
**STEPS:** Remove LINK asset.  
**EXPECTED:** Gone from project; **original file still on disk**.  
**PASS:** Source intact. **FAIL:** Source deleted.

### TEST P3-R — Relink missing
**PURPOSE:** Missing media recovery.  
**STEPS:** Move source → reopen → Relink.  
**EXPECTED:** MISSING then AVAILABLE.  
**PASS:** Preview works after relink. **FAIL:** Corrupt project.

### TEST P3-S — External change
**PURPOSE:** Change detection foundation.  
**STEPS:** Modify linked file bytes if fingerprint UI exposes CHANGED; else note foundation-only.  
**EXPECTED:** CHANGED/AVAILABLE per docs.  
**PASS:** No silent ignore of documented behavior. **FAIL:** Crash.

### TEST P3-T — Crash recovery
**PURPOSE:** Autosave restore.  
**STEPS:** Edit → wait autosave → force-quit (test copy) → reopen → restore if prompted.  
**EXPECTED:** Recovery option; last-good preserved.  
**PASS:** Recoverable. **FAIL:** Silent overwrite of good project.

### TEST P3-U — Low storage
**PURPOSE:** Graceful disk pressure.  
**STEPS:** If possible fill disk / observe warning path; else verify UI messaging exists for storage summary.  
**EXPECTED:** No corruption.  
**PASS:** Safe failure. **FAIL:** Corrupt project.

### TEST P3-V — Search
**PURPOSE:** Find assets.  
**STEPS:** Search by name.  
**EXPECTED:** Correct filter.  
**PASS:** Matches. **FAIL:** Wrong results / crash.

### TEST P3-W — Filter/sort
**PURPOSE:** Browser controls.  
**STEPS:** Filter by type; sort by name.  
**EXPECTED:** Correct ordering/filtering.  
**PASS:** Works. **FAIL:** Broken UI.

### TEST P3-X — User switching
**PURPOSE:** Isolation.  
**STEPS:** User A project+import → logout → User B → no A private metadata/credentials → User A again.  
**EXPECTED:** Strict isolation.  
**PASS:** No cross-user leak. **FAIL:** Leak.

### TEST P3-Y — Diagnostics
**PURPOSE:** Secret safety.  
**STEPS:** Open About/diagnostics with connected provider.  
**EXPECTED:** No API keys/tokens/passwords.  
**PASS:** Clean. **FAIL:** Secret visible.

### TEST P3-Z — Restart
**PURPOSE:** Durability.  
**STEPS:** Restart app; reopen project.  
**EXPECTED:** No data loss.  
**PASS:** Intact. **FAIL:** Loss.

---

## Mandatory security UAT

1. A logs in → project → import → logout  
2. B logs in → must not see A’s account-scoped project/vault/provider secrets  
3. A logs back → project intact  

## Sign-off

| Item | Value |
|------|-------|
| Tester | |
| Date | |
| Automated tests | PASS / FAIL |
| Security / isolation | PASS / FAIL |
| Decision | APPROVE PHASE 3 / REJECT |

**Overall remains PENDING until you explicitly approve.**
