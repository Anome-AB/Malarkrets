#!/usr/bin/env bash
# wipe-and-redeploy.sh — NUCLEAR reset för data-breaking releases.
#
# DETTA RADERAR ALLA DATA I POSTGRES-VOLYMEN.
# Endast för PRE-GO-LIVE eller när en release uttryckligen kräver schema-wipe
# (t.ex. PR #41 som squashade migrationer). För vanliga deploys — använd
# `scripts/deploy-local.sh` istället, den rör ALDRIG volymer.
#
# Vad scriptet gör:
#   1. Kräver explicit bekräftelse (typ "WIPE")
#   2. Backup till ~/backup-pre-wipe-<timestamp>.sql.gz (om postgres kör)
#   3. `docker compose down -v` — stoppar allt + raderar volymer (inkl. caddy!)
#   4. Pullar senaste images (inkl. profile-tools)
#   5. Startar postgres, väntar på pg_isready
#   6. Om DATABASE_URL pekar på en icke-default-DB (t.ex. malarkrets_test) —
#      skapa den manuellt eftersom postgres-containern bara auto-skapar den
#      som står i POSTGRES_DB
#   7. Startar resten, migrate kör från scratch
#   8. Healthcheck + tail migrate-loggen

set -euo pipefail

ENV_FILE=".env"
DEFAULT_DB="malarkrets"   # Det värde postgres-containern auto-initierar
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/health}"

log()  { printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }
fail() { printf "\nERROR: %s\n" "$*" >&2; exit 1; }

# ── Pre-flight ─────────────────────────────────────────────────────────────

command -v docker >/dev/null 2>&1       || fail "docker saknas"
docker compose version >/dev/null 2>&1  || fail "docker compose plugin saknas"
[ -f "docker-compose.yml" ]             || fail "docker-compose.yml saknas — kör från repo-roten"
[ -f "$ENV_FILE" ]                      || fail "$ENV_FILE saknas"

# ── Läs DB-namn från DATABASE_URL ──────────────────────────────────────────
# Format: postgresql://user:pass@host:port/dbname
DB_NAME=$(grep -E '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null | sed -E 's|.*/([^/?]+)$|\1|' | head -1)
[ -n "$DB_NAME" ] || DB_NAME="$DEFAULT_DB"

# ── Varning + bekräftelse ──────────────────────────────────────────────────

cat <<EOF
╔═══════════════════════════════════════════════════════════════════╗
║   DATA-BREAKING RESET                                             ║
╚═══════════════════════════════════════════════════════════════════╝

Detta kommer att:
  • Stoppa alla containrar
  • Radera postgres-volymen (ALL DATA BORTA)
  • Radera caddy-volymen (Let's Encrypt-cert hämtas om automatiskt)
  • Pulla senaste images från ghcr.io
  • Starta från scratch (migrate kör på tom DB)

Aktuell DATABASE_URL pekar på: ${DB_NAME}
EOF

if [ "$DB_NAME" != "$DEFAULT_DB" ]; then
  echo ""
  echo "  ⚠ Icke-default DB-namn — scriptet kommer CREATE DATABASE $DB_NAME efter postgres startar."
fi

echo ""
printf "För att fortsätta, skriv WIPE: "
read -r CONFIRM
[ "$CONFIRM" = "WIPE" ] || fail "avbröts (skrev inte WIPE)"
echo ""

# ── Backup (om postgres kör) ───────────────────────────────────────────────

if docker compose ps postgres --format '{{.Status}}' 2>/dev/null | grep -q "Up"; then
  BACKUP_FILE="$HOME/backup-pre-wipe-$(date +%Y%m%d-%H%M%S).sql.gz"
  log "backup till $BACKUP_FILE"
  docker compose exec -T postgres pg_dumpall -U malarkrets | gzip > "$BACKUP_FILE"
  log "       sparat ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  log "postgres kör inte — hoppar över backup"
fi

# ── Wipe ───────────────────────────────────────────────────────────────────

log "docker compose down -v (containrar + volymer raderas)"
docker compose down -v 2>&1 | tail -5

# ── Pull senaste images ────────────────────────────────────────────────────

log "docker compose pull (alla services + profile-tools)"
docker compose pull --quiet || fail "pull misslyckades — är du inloggad på ghcr.io?"
docker compose --profile tools pull --quiet 2>/dev/null || true

# ── Starta postgres + vänta ─────────────────────────────────────────────────

log "startar postgres..."
docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U malarkrets >/dev/null 2>&1; do
  sleep 1
done
log "       postgres redo"

# ── Skapa custom DB om det behövs ──────────────────────────────────────────

if [ "$DB_NAME" != "$DEFAULT_DB" ]; then
  log "skapar $DB_NAME (postgres auto-initierar bara $DEFAULT_DB)"
  docker compose exec -T postgres psql -U malarkrets -d postgres \
    -c "CREATE DATABASE $DB_NAME;" 2>&1 | tail -3
fi

# ── Starta resten ──────────────────────────────────────────────────────────

log "startar migrate + app + caddy"
docker compose up -d --remove-orphans 2>&1 | tail -10

# ── Vänta på health + rapportera ───────────────────────────────────────────

log "väntar på /api/health..."
for i in $(seq 1 30); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo ""
    log "=== wipe + redeploy klar ==="
    curl -s "$HEALTH_URL"
    echo ""
    echo ""
    docker compose logs migrate --tail 10
    echo ""
    docker compose ps
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
fail "healthcheck failade efter 60s — kolla: docker compose logs app --tail 50"
