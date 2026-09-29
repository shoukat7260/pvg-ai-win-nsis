# Windows release pipeline

## Architecture

| Role | Machine |
|------|---------|
| Development / source | VPS (this repo) |
| Production Windows build | GitHub Actions `windows-latest` (MSVC + NSIS) |
| Manual desktop UAT | User Windows 10/11 PC (installer only) |

Chosen route: **GitHub Actions Windows runner** — not Linux cross-compile.

Workflow: `.github/workflows/windows-release.yml`

## Build steps (automated)

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. Desktop / editor-core / opencut-integration / project-format tests
4. `pnpm exec tauri build --bundles nsis --ci` (from `apps/desktop`)
5. Stage `artifacts/windows/PVG-AI-Setup-x64.exe`
6. Write `release.json` + `.sha256`
7. Verify checksum
8. Upload workflow artifact `pvg-ai-windows-x64`

## Publish to VPS (download endpoint)

```bash
# After a successful Actions run:
scripts/fetch-windows-release.sh thedevsell/PVG-AI
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
gh workflow run windows-release.yml --repo thedevsell/PVG-AI
# or push tag: git tag v0.1.0 && git push origin v0.1.0
```

## Artifact contract

```json
{
  "product": "PVG AI",
  "version": "0.1.0",
  "build": "12",
  "commit": "<sha>",
  "architecture": "x64",
  "artifact": "PVG-AI-Setup-x64.exe",
  "sha256": "<hex>",
  "timestamp": "<iso>",
  "fileSizeBytes": 12345678,
  "workflowRunId": "...",
  "buildEnvironment": "github-actions-windows-latest",
  "target": "x86_64-pc-windows-msvc"
}
```
