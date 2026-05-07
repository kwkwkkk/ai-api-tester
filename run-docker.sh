#!/usr/bin/env bash
set -euo pipefail

APP_NAME="ai-api-tester"
IMAGE_NAME="ai-api-tester"
PORT="3210"
HOST="0.0.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR"

echo "==> Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "==> Recreating container: $APP_NAME"
docker rm -f "$APP_NAME" 2>/dev/null || true

docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  -p "$PORT:$PORT" \
  -e HOST="$HOST" \
  -e PORT="$PORT" \
  "$IMAGE_NAME"

echo "==> Done"
docker ps --filter "name=$APP_NAME"
