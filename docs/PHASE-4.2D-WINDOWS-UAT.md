# PHASE 4.2D — Windows UAT checklist

**Audience:** Human tester on Windows 10/11 x64  
**Source code on Windows:** NOT required  
**Installer:** `PVG-AI-Setup-x64.exe` from browser download or Actions artifact

## Before you start

1. Confirm browser shows **Download for Windows** (not “unavailable”).
2. Note displayed **Version**, **SHA-256**, **file size**.
3. Download the installer.
4. Verify SHA-256 of the downloaded file matches the UI (PowerShell):

```powershell
Get-FileHash .\PVG-AI-Setup-x64.exe -Algorithm SHA256
```

## Installation

| Step | Action | Expected |
|------|--------|----------|
| I1 | Run installer | NSIS wizard opens |
| I2 | Install (current user) | Completes without error |
| I3 | Start menu / launcher | “PVG AI” entry present |
| I4 | Launch PVG AI | App window opens (WebView2 may bootstrap once) |
| I5 | No console/dev server | No terminal window; no localhost dependency |

## Functional checklist

| ID | Action | Expected | Pass? |
|----|--------|----------|-------|
| W1 | Login | Existing PVG account works | ☐ |
| W2 | Logout / relaunch | Session handling correct | ☐ |
| W3 | Create project | Project opens in editor | ☐ |
| W4 | Import MP4 | Asset appears | ☐ |
| W5 | Real video preview | Actual frames (not placeholder) | ☐ |
| W6 | Add to timeline | Clip visible | ☐ |
| W7 | Play / Pause / Seek | Footage syncs with playhead | ☐ |
| W8 | Split / Trim / Move / Delete | Timeline mutates | ☐ |
| W9 | Undo / Redo | Exact restore | ☐ |
| W10 | Transform | Preview updates | ☐ |
| W11 | Add text | Visible on program monitor | ☐ |
| W12 | Add audio | Audible / waveform | ☐ |
| W13 | Effect | Preview changes | ☐ |
| W14 | Transition (fade/dissolve) | Preview / serialize | ☐ |
| W15 | Save / close / reopen | State preserved | ☐ |
| W16 | Export MP4 | File under project `renders/` | ☐ |
| W17 | Play export outside PVG | External player works; text/layers present | ☐ |
| W18 | Keyboard shortcuts | Space, S, Del, Ctrl+Z, etc. | ☐ |
| W19 | Panel resize / scroll | Stable layout | ☐ |
| W20 | Uninstall / reinstall | Clean uninstall; reinstall works | ☐ |

## Known limitations (do not fail UAT solely for these)

- Position keyframe bake in export is limited (static transform at clip start; fades export).
- Wipe/slide transitions less complete than fade/dissolve in export.

## Bug report format

```
Title:
Steps:
Expected:
Actual:
Windows version:
PVG version / commit / SHA-256:
Screenshot / export sample:
```

## After UAT

Human tester reports PASS/FAIL. Do **not** auto-approve.

If PASS → `PHASE 4.2 RELEASE CANDIDATE ACCEPTED`  
If FAIL → return to bug-fix loop (Phase 4.2 rules).
