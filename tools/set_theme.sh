#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: npm run set-theme -- /path/to/theme.msstyles"
  exit 1
fi

root="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$root/tools/import_msstyles.py" "$1" "$root/themes/Current"
