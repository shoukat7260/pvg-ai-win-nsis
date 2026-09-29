#!/usr/bin/env bash
# Download the latest successful Windows release artifact from GitHub Actions onto the VPS.
# Usage: scripts/fetch-windows-release.sh [owner/repo]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi
[[ -n "$REPO" ]] || { echo "Usage: $0 owner/repo" >&2; exit 1; }

DIR="$ROOT/artifacts/windows"
mkdir -p "$DIR"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Fetching latest workflow run for Windows Desktop Release on $REPO ..."
RUN_ID=$(gh run list --repo "$REPO" --workflow "windows-release.yml" --status success --limit 1 --json databaseId -q '.[0].databaseId')
[[ -n "$RUN_ID" && "$RUN_ID" != "null" ]] || { echo "No successful workflow run found" >&2; exit 1; }

echo "Downloading artifact from run $RUN_ID ..."
gh run download "$RUN_ID" --repo "$REPO" --name pvg-ai-windows-x64 --dir "$TMP"

find "$TMP" -type f \( -name 'PVG-AI-Setup-x64.exe' -o -name 'release.json' -o -name '*.sha256' \) -exec cp -f {} "$DIR/" \;

bash "$ROOT/scripts/verify-windows-release.sh"
echo "Installed release files into $DIR"
ls -la "$DIR"
