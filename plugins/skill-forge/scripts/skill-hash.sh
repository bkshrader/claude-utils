#!/usr/bin/env bash
# Print a short content hash of a SKILL.md. Workflow resume replays any agent
# call whose prompt is unchanged, so every run prompt carries this hash: an
# edited skill must never get stale cached results.
set -euo pipefail
sha256sum "${1:?usage: skill-hash.sh <SKILL.md>}" | cut -c1-12
