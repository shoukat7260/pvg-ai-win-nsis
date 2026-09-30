# Windows release pipeline

## Architecture

| Role | Machine |
|------|---------|
| Development / source | VPS (canonical repo `thedevsell/PVG-AI`) |
| Production Windows build | GitHub Actions `windows-latest` (MSVC + NSIS + WebView2 bootstrapper) |
| Manual desktop UAT | User Windows 10/11 PC (installer only — no source tree) |

Chosen route: **GitHub Actions Windows runner** — not Linux cross-compile.

### Canonical workflow

`.github/workflows/windows-release.yml` — intended path for `thedevsell/PVG-AI`.

**Current operational note (Phase 4.2D):** pushing/updating workflow files on `thedevsell/PVG-AI` requires a GitHub credential with the `workflow` scope, and Actions on that account was billing-locked during 4.2D. The verified installer was therefore produced by an inherited Windows `Dev Build` workflow on builder mirror `shoukat7260/pvg-ai-win-nsis` (branch `pvg-build`), without modifying that upstream workflow YAML. After billing + workflow-scope are restored, prefer the canonical `windows-release.yml` on `thedevsell/PVG-AI`.

## Build steps (automated)

Canonical `windows-release.yml`:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. Desktop / editor-core / opencut-integration / project-format tests
4. `pnpm exec tauri build --bundles nsis --ci` (from `apps/desktop`)
5. Stage `artifacts/windows/PVG-AI-Setup-x64.exe`
6. Write `release.json` + `.sha256`
7. Verify checksum
8. Upload workflow artifact `pvg-ai-windows-x64`

Builder mirror (temporary): `pnpm tauri build --target x86_64-pc-windows-msvc` with root `src-tauri/` + monorepo frontend.

## Publish to VPS (download endpoint)

```bash
# Preferred when canonical workflow artifacts exist:
scripts/fetch-windows-release.sh thedevsell/PVG-AI

# Stage from an arbitrary successful Actions run (used for 4.2D builder):
scripts/stage-windows-artifact-from-run.sh shoukat7260/pvg-ai-win-nsis <run_id> dev-v0.1.0-Windows-x64

scripts/verify-windows-release.sh
```

Vite serves only allowlisted files:

- `/downloads/windows/release.json`
- `/downloads/windows/PVG-AI-Setup-x64.exe`
- `/downloads/windows/PVG-AI-Setup-x64.exe.sha256`

from `artifacts/windows/` with `Cache-Control: no-store`.

Browser `/app/edit` enables **Download for Windows** only when `release.json` exists and includes `artifact` + `sha256`.

## Trigger

```bash
# Canonical (when workflow scope + billing OK):
gh workflow run windows-release.yml --repo thedevsell/PVG-AI

# Temporary builder:
gh workflow run "Dev Build" --repo shoukat7260/pvg-ai-win-nsis --ref pvg-build
```

## Artifact contract

```json
{
  "product": "PVG AI",
  "version": "0.1.0",
  "build": "4",
  "commit": "<sha>",
  "architecture": "x64",
  "artifact": "PVG-AI-Setup-x64.exe",
  "sha256": "<hex>",
  "timestamp": "<iso>",
  "fileSizeBytes": 3378714,
  "workflowRunId": "...",
  "buildEnvironment": "github-actions-windows-latest",
  "target": "x86_64-pc-windows-msvc"
}
```

## Verified 4.2D artifact (VPS) — hotfix 0.1.1

| Field | Value |
|-------|--------|
| Path | `artifacts/windows/PVG-AI-Setup-x64.exe` |
| Size | 5023908 bytes |
| Version | 0.1.1 |
| SHA-256 | `5ced74048b13e695ab1b9279daab6705fe7677ed7092b7891df77f65256d8216` |
| Production API (packaged) | `http://62.171.139.173:8000` |
| HTTP | `GET /downloads/windows/PVG-AI-Setup-x64.exe` → 200, integrity PASS |
