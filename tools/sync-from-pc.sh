#!/usr/bin/env bash
# Copies the desktop web UI (assets/ and prebuilt/) from the PC client and plugs the browser
# host into every page, like the Android and iPhone copies. Usage: tools/sync-from-pc.sh [PC repo]
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
pc="${1:-$here/..}"
[ -f "$pc/main.js" ] || { echo "PC client not found at $pc" >&2; exit 1; }

# Files that exist only in the browser version survive the copy.
keep="$(mktemp -d)"
cp "$here/assets/js/web-bridge.js" "$here/assets/css/web.css" "$keep/" 2>/dev/null || true
rm -rf "$here/assets" "$here/prebuilt"
cp -R "$pc/assets" "$pc/prebuilt" "$here/"
cp "$keep"/* "$here/assets/" 2>/dev/null || true
[ -f "$keep/web-bridge.js" ] && mv "$here/assets/web-bridge.js" "$here/assets/js/"
[ -f "$keep/web.css" ] && mv "$here/assets/web.css" "$here/assets/css/"
rm -rf "$keep"

# Every page takes window.windowControls from the host page instead of preload.js.
for page in "$here"/assets/html/*.html; do
  grep -q 'web-bridge.js' "$page" && continue
  sed -i 's#</head>#<script src="assets/js/web-bridge.js"></script><link rel="stylesheet" href="assets/css/web.css"></head>#' "$page"
done

# Built-in themes: the browser cannot list a directory, so write their ids down.
(cd "$here/prebuilt" && printf '%s\n' */theme.json | sed 's#/theme.json##' | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))' > index.json)
echo "Synced from $pc"
