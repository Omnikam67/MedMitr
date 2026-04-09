#!/usr/bin/env bash
set -e

gunicorn main:app -k uvicorn.workers.UvicornWorker -w 2 --bind 0.0.0.0:"${PORT:-8000}" --timeout 120 --access-logfile -
