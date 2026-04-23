#!/usr/bin/env bash
# deploy-local.sh — Deploy Mälarkrets från GitHub + ghcr.io.
#
# Används både på utvecklarens maskin (Docker Desktop) och på VPS:en.
# Idempotent: säkert att köra när som helst; data-volymer rörs aldrig.
#
# Förutsättningar (görs separat av scripts/provision-vps.sh på färsk server):
#   - docker + docker compose installerade
#   - repot klonat, denna katalog = git-roten
#   - .env skapad från .env.prod.example (eller .env.staging.example) och ifylld
#   - Caddyfile finns (följer med git)
#   - docker login ghcr.io körd minst en gång (PAT med read:packages)
#
# Flags (via env-variabler):
#   SKIP_GIT_PULL=1        hoppa över git-pull (t.ex. vid PR-test)
#   SKIP_IMAGE_PULL=1      hoppa över docker pull (t.ex. när du bygger lokalt)
#   HEALTH_URL=...         anpassa (default: http://localhost:3000/api/health)

set -euo pipefail

# docker-compose.yml is the Docker convention default — no -f flag needed.
ENV_FILE=".env"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"
MAX_HEALTH_RETRIES="${MAX_HEALTH_RETRIES:-30}"
HEALTH_RETRY_INTERVAL="${HEALTH_RETRY_INTERVAL:-2}"
SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
SKIP_IMAGE_PULL="${SKIP_IMAGE_PULL:-0}"

log()  { printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
fail() { printf "\nERROR: %s\n" "$*" >&2; exit 1; }

# Pretty JSON om jq finns, annars bara skriv ut som det är.
pp_json() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

log "=== Mälarkrets deploy ==="

# ── Steg 0: Pre-flight ───────────────────────────────────────────────────────
# Felar tidigt med tydliga meddelanden istället för kryptiska compose-fel.
command -v docker >/dev/null 2>&1       || fail "docker saknas. Installera Docker."
docker compose version >/dev/null 2>&1  || fail "docker compose plugin saknas."
command -v curl >/dev/null 2>&1         || fail "curl saknas."
[ -f "docker-compose.yml" ]             || fail "docker-compose.yml saknas — kör från repo-roten."
[ -f "$ENV_FILE" ]                      || fail "$ENV_FILE saknas — kopiera .env.prod.example (eller .env.staging.example) till .env och fyll i värden."
[ -f "Caddyfile" ]                      || fail "Caddyfile saknas — den ska vara checkad in i git."
[ -f "otel-collector-config.yaml" ]     || fail "otel-collector-config.yaml saknas — behövs av otel-collector-containern."

# ── Steg 1: Git pull (för compose/scripts/Caddyfile — appkoden kommer från ghcr.io) ─
if [ "$SKIP_GIT_PULL" = "1" ]; then
  log "[1/5] git pull hoppas över (SKIP_GIT_PULL=1)"
elif [ ! -d .git ]; then
  log "[1/5] inte ett git-repo — hoppar över git pull"
else
  log "[1/5] git pull (infra-filer; appkoden kommer från ghcr.io)"
  # Bryt tidigt om det finns lokala ändringar på VPS:en — då har någon
  # hand-editerat, och `git pull` skulle försöka merga och potentiellt haltera.
  if [ -n "$(git status --porcelain)" ]; then
    fail "Lokala ändringar finns i arbetsträdet. Committa, stasha eller återställ innan deploy."
  fi
  BRANCH=$(git branch --show-current)
  git fetch --prune origin
  LOCAL=$(git rev-parse HEAD)
  # --verify --quiet skriver inget till stdout vid okänd ref (till skillnad
  # från ren `git rev-parse`, som ekar strängen och ändå exit:ar 0/128 udda).
  # refs/remotes/origin/... undviker disambiguerings-gissningar.
  REMOTE=$(git rev-parse --verify --quiet "refs/remotes/origin/$BRANCH" || true)
  if [ -z "$REMOTE" ]; then
    log "       $BRANCH har ingen upstream — hoppar över merge"
  elif [ "$LOCAL" = "$REMOTE" ]; then
    log "       redan på origin/$BRANCH ($LOCAL)"
  else
    git merge --ff-only "origin/$BRANCH"
    log "       uppdaterad till $(git rev-parse --short HEAD)"
  fi
fi

# ── Steg 2: Docker pull (hämtar nya images från ghcr.io + stock-uppdateringar) ─
# Obs: `docker compose pull` utan args hoppar över services med `profiles:`
# (t.ex. `seed`). Vi pullar dem explicit också för att inte hamna med en 5-
# dagar-gammal seed-image när någon senare kör `docker compose run --rm seed`.
if [ "$SKIP_IMAGE_PULL" = "1" ]; then
  log "[2/5] docker pull hoppas över (SKIP_IMAGE_PULL=1)"
else
  log "[2/5] docker compose pull"
  if ! docker compose pull --quiet; then
    fail "docker pull misslyckades — kör 'docker login ghcr.io' med en PAT som har read:packages."
  fi
  # Profile-tools-services (seed) — måste pullas separat.
  docker compose --profile tools pull --quiet 2>/dev/null || true
fi

# Logga vilken tag som faktiskt körs (användbart vid rollback-verifiering).
APP_TAG=$(grep -E '^APP_TAG=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
MIGRATE_TAG=$(grep -E '^MIGRATE_TAG=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
log "       APP_TAG=${APP_TAG:-latest}  MIGRATE_TAG=${MIGRATE_TAG:-migrate-latest}"

# ── Steg 3: Starta postgres och vänta på att den är klar ─────────────────────
# Vi startar postgres separat här så migrate-containern inte måste börja
# polla förrän DB:n accepterar anslutningar. Compose's service_healthy
# täcker det i teorin, men explicit väntan ger bättre loggutskrift.
log "[3/5] startar postgres..."
docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U malarkrets >/dev/null 2>&1; do
  sleep 1
done
log "       postgres redo."

# ── Steg 4: Starta alla tjänster ─────────────────────────────────────────────
# Compose hanterar ordningen via depends_on:
#   migrate → exit 0 → app startar → caddy startar → otel-collector parallellt
# Idempotent: migrate använder Drizzles journal-tabell och gör ingenting
# om det inte finns nya migrationer.
log "[4/5] docker compose up -d (migrate kör, sedan app + caddy)"
docker compose up -d --remove-orphans

# ── Steg 5: Healthcheck ──────────────────────────────────────────────────────
log "[5/5] väntar på /api/health..."
for i in $(seq 1 "$MAX_HEALTH_RETRIES"); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo ""
    log "=== deploy klar ==="
    curl -s "$HEALTH_URL" | pp_json
    echo ""
    docker compose ps
    exit 0
  fi
  printf "."
  sleep "$HEALTH_RETRY_INTERVAL"
done

echo ""
log "HEALTHCHECK MISSLYCKADES efter $((MAX_HEALTH_RETRIES * HEALTH_RETRY_INTERVAL))s"
log "Senaste app-loggar:"
docker compose logs app --tail 50 >&2 || true
log "Senaste migrate-loggar (om migrationen failade):"
docker compose logs migrate --tail 30 >&2 || true
exit 1
