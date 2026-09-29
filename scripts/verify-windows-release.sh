#!/usr/bin/env bash
# Verify artifacts/windows release contract on the VPS.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/artifacts/windows"
EXE="$DIR/PVG-AI-Setup-x64.exe"
JSON="$DIR/release.json"
SUM="$DIR/PVG-AI-Setup-x64.exe.sha256"

fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "PASS: $*"; }

[[ -f "$EXE" ]] || fail "installer missing: $EXE"
[[ -f "$JSON" ]] || fail "release.json missing"
[[ -s "$EXE" ]] || fail "installer is empty"

SIZE=$(wc -c <"$EXE" | tr -d ' ')
[[ "$SIZE" -gt 1000000 ]] || fail "installer suspiciously small ($SIZE bytes)"

command -v sha256sum >/dev/null || fail "sha256sum required"
ACTUAL=$(sha256sum "$EXE" | awk '{print $1}')

EXPECTED=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sha256"].lower())' "$JSON")
[[ "$ACTUAL" == "$EXPECTED" ]] || fail "SHA-256 mismatch actual=$ACTUAL expected=$EXPECTED"

if [[ -f "$SUM" ]]; then
  FILE_SUM=$(awk '{print tolower($1)}' "$SUM")
  [[ "$FILE_SUM" == "$ACTUAL" ]] || fail ".sha256 file mismatch"
fi

python3 -c '
import json,sys
m=json.load(open(sys.argv[1]))
for k in ("product","version","build","commit","architecture","artifact","sha256","timestamp"):
    assert m.get(k), f"missing {k}"
assert m["artifact"]=="PVG-AI-Setup-x64.exe"
print("manifest ok", m["version"], m["commit"][:8])
' "$JSON"

ok "installer size=${SIZE} sha256=${ACTUAL}"
echo "$SIZE" > "$DIR/.verified-size"
echo "$ACTUAL" > "$DIR/.verified-sha256"
