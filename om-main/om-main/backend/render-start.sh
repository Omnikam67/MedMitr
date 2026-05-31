#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
echo "Starting backend in: $(pwd)"
echo "Listing backend files:"
ls -la

echo "Python version: $(python -V 2>&1)"
echo "uvicorn available:"
python -m uvicorn --help >/dev/null 2>&1 && echo "yes" || echo "no"
echo "PORT=${PORT:-<not set>}"
echo "ENV PORT value: $PORT"

echo "Starting uvicorn on 0.0.0.0:${PORT:-8000}"
exec python -m uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --log-level info
