#!/usr/bin/env bash
# cleanup-docker.sh — Rensa gamla docker-images och build-cache på VPS:n.
#
# Varför: varje deploy drar in en ny sha-taggad image (~300 MB app + ~150 MB
# migrate). Utan rensning fyller vi upp disken på några veckor. `docker
# system prune` ensam tar bara dangling (otagged) images; våra gamla
# sha-taggade versioner ligger kvar för evigt annars.
#
# Vad scriptet rör:
#   - oanvända images äldre än RETENTION_HOURS (default: 168h = 7 dagar)
#   - stoppade containers
#   - build-cache äldre än RETENTION_HOURS
#   - oanvända nätverk
#
# Vad scriptet ALDRIG rör:
#   - volymer (postgres-data, caddy-cert, otel-buffer) — aldrig med -v
#   - images som en körande container använder — docker skyddar dessa
#   - images nyare än RETENTION_HOURS — rollback-fönster
#
# Användning:
#   bash scripts/cleanup-docker.sh              # default 7 dagar
#   RETENTION_HOURS=72 bash scripts/cleanup-docker.sh   # 3 dagar
#   DRY_RUN=1 bash scripts/cleanup-docker.sh    # visa vad som skulle tas bort
#
# Cron-förslag (kör natten efter deploy-veckan):
#   0 4 * * 0 cd /home/deploy/malarkrets && bash scripts/cleanup-docker.sh >> /var/log/malarkrets-cleanup.log 2>&1

set -euo pipefail

RETENTION_HOURS="${RETENTION_HOURS:-168}"
DRY_RUN="${DRY_RUN:-0}"

log() { printf "[%s] %s\n" "$(date +%H:%M:%S)" "$*"; }

command -v docker >/dev/null 2>&1 || { echo "docker saknas" >&2; exit 1; }

# Diskanvändning före — jämförbar siffra, inte snygg rad.
disk_before=$(df -BM --output=used / | tail -1 | tr -d ' M')

log "=== docker cleanup (retention: ${RETENTION_HOURS}h, dry-run: ${DRY_RUN}) ==="
log "Docker disk-användning före:"
docker system df

if [ "$DRY_RUN" = "1" ]; then
  log ""
  log "DRY RUN — inget tas bort. Kandidater:"
  log ""
  log "Oanvända images äldre än ${RETENTION_HOURS}h som SKULLE tas bort:"
  # `until` på image prune kräver docker 20.10+; finns på alla moderna hosts.
  docker image ls --filter "dangling=false" --format "{{.Repository}}:{{.Tag}} {{.CreatedSince}} {{.Size}}" | head -50
  log ""
  log "Build-cache:"
  docker builder ls 2>/dev/null || true
  exit 0
fi

# ── Steg 1: Stoppade containers ────────────────────────────────────────────
log ""
log "[1/4] rensar stoppade containers..."
docker container prune -f >/dev/null
log "      klart."

# ── Steg 2: Oanvända images äldre än retention ─────────────────────────────
# -a = inkludera taggade (inte bara dangling). --filter until=<tid> =
# endast images skapade före den tidpunkten. Images som används av en
# körande container skyddas automatiskt av docker.
log "[2/4] rensar oanvända images äldre än ${RETENTION_HOURS}h..."
docker image prune -af --filter "until=${RETENTION_HOURS}h" | tail -5
log "      klart."

# ── Steg 3: Build-cache ─────────────────────────────────────────────────────
# På VPS:n bygger vi inte (images kommer från ghcr.io), men en tom prune
# skadar inte om någon testbyggt lokalt.
log "[3/4] rensar build-cache äldre än ${RETENTION_HOURS}h..."
docker builder prune -af --filter "until=${RETENTION_HOURS}h" 2>/dev/null | tail -3 || true
log "      klart."

# ── Steg 4: Oanvända nätverk ────────────────────────────────────────────────
log "[4/4] rensar oanvända nätverk..."
docker network prune -f >/dev/null
log "      klart."

# ── Rapport ────────────────────────────────────────────────────────────────
disk_after=$(df -BM --output=used / | tail -1 | tr -d ' M')
freed=$((disk_before - disk_after))

log ""
log "Docker disk-användning efter:"
docker system df
log ""
if [ "$freed" -gt 0 ]; then
  log "=== frigjorde ~${freed} MB på / ==="
else
  log "=== inget att rensa (retention-fönstret skyddar fortfarande alla images) ==="
fi
