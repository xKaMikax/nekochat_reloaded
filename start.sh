#!/usr/bin/env bash
# Runs the Nekochat Reloaded companion server.
#   NEKOCHAT_SERVERS  Nekochat servers whose accounts can link (comma-separated), default: the public one
#   RELOADED_DB       SQLite file, default: reloaded.db
# Usage: ./start.sh [port]   (default 8002)
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] || { uv venv -q --python 3.12 .venv && uv pip install -q --python .venv/bin/python -r requirements.txt; }
exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "${1:-8002}"
