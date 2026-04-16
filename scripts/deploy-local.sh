#!/usr/bin/env bash
# deploy-local.sh — Pull latest image from ghcr.io and deploy locally
# Requires: docker, docker compose, Git Bash or WSL on Windows
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_URL="http://localhost:3000/api/health"
MAX_RETRIES=30
RETRY_INTERVAL=2

echo "=== Mälarkrets Local Deploy ==="

# Check prerequisites
if ! command -v docker &> /dev/null; then
  echo "ERROR: docker not found. Install Docker Desktop." >&2
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: $COMPOSE_FILE not found. Run from project root." >&2
  exit 1
fi

if [ ! -f ".env.prod" ]; then
  echo "ERROR: .env.prod not found. Copy .env.prod.example and fill in values." >&2
  exit 1
fi

# Pull latest images (app + migrate)
echo "[1/4] Pulling latest images..."
docker compose -f "$COMPOSE_FILE" pull app migrate

# Start database first
echo "[2/4] Starting database..."
docker compose -f "$COMPOSE_FILE" up -d postgres
echo "       Waiting for postgres to be healthy..."
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U malarkrets > /dev/null 2>&1; do
  sleep 1
done
echo "       Postgres is ready."

# Start all services. The `migrate` service runs Drizzle migrations and exits;
# `app` waits for `migrate` to complete successfully (compose depends_on).
echo "[3/4] Running migrations and starting services..."
docker compose -f "$COMPOSE_FILE" up -d

# Health check
echo "[4/4] Waiting for health check..."
for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo ""
    echo "=== Deploy complete! ==="
    echo "App:   http://localhost:3000"
    echo "MinIO: http://localhost:9001 (console)"
    echo ""
    curl -s "$HEALTH_URL" | python3 -m json.tool 2>/dev/null || curl -s "$HEALTH_URL"
    exit 0
  fi
  printf "."
  sleep $RETRY_INTERVAL
done

echo ""
echo "ERROR: Health check failed after $((MAX_RETRIES * RETRY_INTERVAL))s" >&2
echo "Check logs: docker compose -f $COMPOSE_FILE logs app" >&2
exit 1
