#!/usr/bin/env bash
# Create one capture record in the skill-forge inbox and print its path.
# Usage: capture.sh <tag> [note...]
# Location-independent by design: this runs from whatever project the problem
# happened in, and the inbox lives outside every repo because the plugin root
# is a cache copy, not the claude-utils checkout. The command that calls this
# fills in prompt / what_went_wrong / what_fixed_it from conversation context.
set -euo pipefail
. "$(dirname "$0")/common.sh"

tag="${1:?usage: capture.sh <tag> [note...]}"
shift || true
note="$*"

if ! printf '%s' "$tag" | grep -Eq '^[a-z0-9][a-z0-9-]*$'; then
  echo "skill-forge: tag must be kebab-case (got '$tag')" >&2
  exit 2
fi

mkdir -p "$SKILL_FORGE_INBOX"
ts="$(python3 -c 'import datetime;print(datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%f")[:-3]+"Z")')"   # ms suffix: two captures in one second must not collide
file="$SKILL_FORGE_INBOX/$ts-$tag.json"
while [ -e "$file" ]; do file="${file%.json}-$RANDOM.json"; done
python3 - "$file" "$tag" "$PWD" "$note" <<'PY'
import json, sys, datetime
file, tag, project, note = sys.argv[1:5]
json.dump({
    "tag": tag,
    "project": project,
    "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "note": note,
    "prompt": "",
    "what_went_wrong": "",
    "what_fixed_it": "",
}, open(file, "w"), indent=2)
print(file)
PY
