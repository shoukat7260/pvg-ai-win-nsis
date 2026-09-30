# PHASE 4.3 WINDOWS UAT

**Product:** PVG AI Desktop  
**Candidate version:** **0.1.3**  
**Installer:** `PVG-AI-Setup-x64.exe`  
**STATUS:** Engineering gates prepared — **WINDOWS MANUAL UAT: PENDING**

Fill after installing the NSIS artifact on Windows 10/11 x64.

## Engineering pre-gates

| Gate | Status |
|------|--------|
| Continuous keyframe export (per-frame) | PASS |
| Real-media E2E export + ffprobe | PASS |
| Preview/export shared evaluator semantics | PASS |
| NLE regression (4.3/B/C suites) | PASS |
| Project lifecycle regression | PASS |
| Auth regression (code + prior API smoke) | PASS (code) |
| Typecheck | PASS |
| pvg-media / pvg-core / editor-core tests | PASS |
| Version 0.1.3 | SET |
| Code on GitHub (`release/0.1.3`) | PASS |
| Windows NSIS build (GH Actions) | PENDING — need `workflow` scope to publish `windows-release.yml` |
| release.json + SHA-256 | PENDING 0.1.3 artifact |
| Browser `/downloads/windows/*` | PENDING publish |
| Custom NSIS storytelling | PARTIAL / DEFERRED (stable installer retained) |
| OpenCut WASM | DEFERRED (non-blocking) |

## Checklist

### INSTALLER
[ ] Installer launches  
[ ] Install completes  
[ ] Desktop shortcut  
[ ] Start Menu entry  
[ ] Correct PVG AI icon  
[ ] Taskbar / window icon  
[ ] Uninstall  
[ ] Reinstall  

### STARTUP
[ ] Splash / initializing phases  
[ ] No infinite loading / blank shell  

### AUTH
[ ] Sign up  
[ ] Sign in  
[ ] Session restore after restart  
[ ] Wrong password message  
[ ] Offline / API down message  
[ ] Logout → login  

### HOME / PROJECTS / LIBRARY / TEMPLATES / AI
[ ] Home create + recent  
[ ] Projects search/sort  
[ ] Rename / Duplicate / Trash / Restore  
[ ] Thumbnail  
[ ] Library / Templates / AI workspace  

### EDITOR
[ ] Open project  
[ ] Media import (use fixtures where helpful)  
[ ] Timeline: select, multi-select, drag, trim, split, duplicate, cross-track, delete, ripple delete, roll, markers, lock, mute, solo, snap, zoom, scroll  
[ ] Viewer play/pause/seek/frame step  
[ ] Text / Audio / Effects / Transitions (supported)  
[ ] Keyframes animate in preview  
[ ] Save / close / reopen  
[ ] Export playable MP4  
[ ] Play exported MP4 outside PVG AI (composition + audio + text)  

### SETTINGS / ABOUT
[ ] Settings navigate  
[ ] About  

## Result

WINDOWS MANUAL UAT: **PENDING**

Do not mark COMPLETE / APPROVED / RELEASED until this checklist is filled by a human on Windows.
