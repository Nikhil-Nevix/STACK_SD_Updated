#!/bin/bash
set -e
PORT=${PORT:-8080}
echo "Starting STACK FastAPI server on port $PORT"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT" --workers 1 --log-level info
