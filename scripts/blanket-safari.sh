#!/usr/bin/env bash
# Span Safari across all connected displays.
#
# Prereqs (do once in System Settings):
#   - Desktop & Dock → Displays have separate Spaces: OFF
#   - Desktop & Dock → Automatically hide and show the menu bar: ON
#   - Desktop & Dock → Automatically hide and show the Dock: ON
#
# Usage:
#   ./scripts/blanket-safari.sh
#   ORB_URL="https://your-app.vercel.app/?quality=kiosk#/" ./scripts/blanket-safari.sh
#   ./scripts/blanket-safari.sh "http://localhost:5176/#/avatars"
#   ./scripts/blanket-safari.sh --per-display   # one window per screen

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_URL="${ORB_URL:-http://localhost:5176/?quality=kiosk#/}"

if [[ "${1:-}" == "--per-display" ]]; then
  shift
  exec osascript "$ROOT/scripts/blanket-safari-per-display.applescript" "${1:-$DEFAULT_URL}"
fi

exec osascript "$ROOT/scripts/blanket-safari.applescript" "${1:-$DEFAULT_URL}"
