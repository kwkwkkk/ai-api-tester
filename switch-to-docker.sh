#!/usr/bin/env bash
set -euo pipefail

APP_NAME="ai-api-tester"
IMAGE_NAME="ai-api-tester"
PORT="3210"
HOST="0.0.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

echo "==> Working directory: $SCRIPT_DIR"

echo "==> Checking old listeners on :$PORT"
PIDS="$(ss -ltnp 2>/dev/null | grep ":$PORT" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)"

if [ -n "$PIDS" ]; then
  echo "==> Stopping old process(es): $PIDS"
  kill $PIDS || true
  sleep 2

  REMAINING="$(ss -ltnp 2>/dev/null | grep ":$PORT" | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u || true)"
  if [ -n "$REMAINING" ]; then
    echo "==> Force killing remaining process(es): $REMAINING"
    kill -9 $REMAINING || true
    sleep 1
  fi
else
  echo "==> No old process found on :$PORT"
fi

echo "==> Removing old container if exists"
docker rm -f "$APP_NAME" 2>/dev/null || true

echo "==> Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "==> Starting container: $APP_NAME"
docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  -p "$PORT:$PORT" \
  -e HOST="$HOST" \
  -e PORT="$PORT" \
  "$IMAGE_NAME"

echo "==> Waiting for service"
sleep 3

echo "==> Container status"
docker ps --filter "name=$APP_NAME"

echo "==> Health check"
curl -fsS "http://127.0.0.1:$PORT/" >/dev/null && echo "OK: http://127.0.0.1:$PORT/" || {
  echo "ERROR: health check failed"
  echo "---- container logs ----"
  docker logs "$APP_NAME" || true
  exit 1
}

echo "==> Done"
echo "LAN URL: http://$(hostname -I | awk '{print $1}'):$PORT/"
