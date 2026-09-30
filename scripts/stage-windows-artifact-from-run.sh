#!/usr/bin/env bash
# Stage a Windows NSIS installer from a GitHub Actions run into artifacts/windows/.
# Usage:
#   scripts/stage-windows-artifact-from-run.sh <owner/repo> <run_id> [artifact_name_glob]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${1:?owner/repo required}"
RUN_ID="${2:?run_id required}"
ART_GLOB="${3:-}"

DIR="$ROOT/artifacts/windows"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DIR"

echo "Downloading artifacts from $REPO run $RUN_ID ..."
if [[ -n "$ART_GLOB" ]]; then
  gh run download "$RUN_ID" --repo "$REPO" --name "$ART_GLOB" --dir "$TMP"
else
  gh run download "$RUN_ID" --repo "$REPO" --dir "$TMP"
fi

EXE_SRC=$(find "$TMP" -type f -name '*.exe' | head -n 1 || true)
[[ -n "$EXE_SRC" ]] || { echo "No .exe found in downloaded artifacts" >&2; find "$TMP" -type f >&2; exit 1; }
[[ -s "$EXE_SRC" ]] || { echo "Installer is empty" >&2; exit 1; }

cp -f "$EXE_SRC" "$DIR/PVG-AI-Setup-x64.exe"
SIZE=$(wc -c <"$DIR/PVG-AI-Setup-x64.exe" | tr -d ' ')
HASH=$(sha256sum "$DIR/PVG-AI-Setup-x64.exe" | awk '{print $1}')
VERSION=$(python3 -c 'import json; print(json.load(open("apps/desktop/package.json"))["version"])' 2>/dev/null || echo "0.1.0")
# Prefer the commit that produced this workspace mirror; fall back to HEAD.
COMMIT=$(git -C "$ROOT" rev-parse HEAD)
BUILD=$(gh run view "$RUN_ID" --repo "$REPO" --json number -q .number)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

python3 - <<PY
import json
manifest = {
  "product": "PVG AI",
  "version": "$VERSION",
  "build": str("$BUILD"),
  "commit": "$COMMIT",
  "architecture": "x64",
  "artifact": "PVG-AI-Setup-x64.exe",
  "sha256": "$HASH",
  "timestamp": "$TS",
  "fileSizeBytes": int("$SIZE"),
  "workflowRunId": str("$RUN_ID"),
  "buildEnvironment": "github-actions-windows-latest",
  "target": "x86_64-pc-windows-msvc",
  "sourceRepo": "$REPO",
}
open("$DIR/release.json", "w", encoding="utf-8").write(json.dumps(manifest, indent=2) + "\n")
open("$DIR/PVG-AI-Setup-x64.exe.sha256", "w", encoding="ascii").write("$HASH  PVG-AI-Setup-x64.exe\n")
print(json.dumps(manifest, indent=2))
PY

bash "$ROOT/scripts/verify-windows-release.sh"
echo "Staged installer into $DIR"
ls -la "$DIR"
