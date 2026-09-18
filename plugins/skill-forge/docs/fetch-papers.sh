#!/usr/bin/env bash
# Re-download the papers skill-forge is built on. The SkillOpt PDF is gitignored
# (arXiv non-exclusive-distrib license), so run this after a fresh clone.
set -euo pipefail
cd "$(dirname "$0")"
curl -fsSL -o 2605.23899-skilllens.pdf https://arxiv.org/pdf/2605.23899
curl -fsSL -o 2605.23904-skillopt.pdf  https://arxiv.org/pdf/2605.23904
ls -l ./*.pdf
