#!/usr/bin/env bash
# Launch Station III wall mode: one cropped Chrome window per display.
#
# Usage:
#   ./scripts/blanket-station3-wall.sh
#   ORB_URL="https://house-of-negotiated-selves.vercel.app/" ./scripts/blanket-station3-wall.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_URL="${ORB_URL:-https://house-of-negotiated-selves.vercel.app/}"

exec osascript "$ROOT/scripts/blanket-station3-wall.applescript" "${1:-$DEFAULT_URL}"
