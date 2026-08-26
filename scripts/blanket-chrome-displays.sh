#!/usr/bin/env bash
# One Chrome window per display, each filling its screen.
#
# Usage:
#   ./scripts/blanket-chrome-displays.sh
#   ORB_URL="https://house-of-negotiated-selves.vercel.app/?quality=kiosk#/" ./scripts/blanket-chrome-displays.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_URL="${ORB_URL:-http://localhost:5176/?quality=kiosk#/}"

exec osascript "$ROOT/scripts/blanket-chrome-displays.applescript" "$DEFAULT_URL"
