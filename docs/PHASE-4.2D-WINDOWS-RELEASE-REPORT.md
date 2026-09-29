# PHASE 4.2D — Windows Release Report

**STATUS: NOT READY** (until installer exists on VPS and download is verified)

Updated as the pipeline progresses.

## Pipeline

| Item | Value |
|------|--------|
| Workflow | `.github/workflows/windows-release.yml` |
| Build machine | GitHub Actions `windows-latest` |
| Target | `x86_64-pc-windows-msvc` / NSIS |
| Fetch script | `scripts/fetch-windows-release.sh` |
| Verify script | `scripts/verify-windows-release.sh` |
| Browser path | `/downloads/windows/` (Vite allowlist) |

## Known functional limitations (honest)

- Position keyframe bake in export: limited (static transform; opacity/volume fades OK)
- Wipe/slide export: limited vs fade/dissolve

## Results (fill after build)

| Field | Value |
|-------|--------|
| Workflow result | PENDING |
| Installer path | `artifacts/windows/PVG-AI-Setup-x64.exe` |
| Installer size | TBD |
| Version | TBD |
| Commit | TBD |
| SHA-256 | TBD |
| Browser download path | `/downloads/windows/PVG-AI-Setup-x64.exe` |
| Automated tests | TBD |
| Download HTTP verify | TBD |
| Windows manual UAT | **PENDING** |

## Final status rule

Before human Windows UAT:

- If installer + release.json + SHA-256 + download verified + tests PASS → **READY FOR USER ACCEPTANCE** (WINDOWS MANUAL UAT: PENDING)
- Else → **NOT READY**

After human UAT PASS → **PHASE 4.2 RELEASE CANDIDATE ACCEPTED** (human only; no auto-approve)
