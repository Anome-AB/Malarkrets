#!/usr/bin/env bash
# provision-vps.sh — one-shot host provisioning for a fresh Ubuntu 24.04 LTS VPS.
#
# Run as root on a blank box. Idempotent: safe to re-run.
#
#   SSH_PUBKEY="ssh-ed25519 AAAA..." bash provision-vps.sh
#
# Env vars:
#   SSH_PUBKEY     Required. Public key authorized for the deploy user.
#   DEPLOY_USER    Default: deploy
#   SWAP_SIZE_GB   Default: 2
#
# What it does NOT do (deliberately, these are app-deploy concerns):
#   - Clone the repo
#   - Write .env.prod (scp that in manually, never put secrets in a script)
#   - Start docker-compose
#
# After this finishes, follow the printed next-steps.

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-2}"
SSH_PUBKEY="${SSH_PUBKEY:-}"

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: run as root (or via sudo)" >&2
  exit 1
fi

if [ -z "$SSH_PUBKEY" ]; then
  echo "ERROR: SSH_PUBKEY env var required" >&2
  echo "  example: SSH_PUBKEY=\"ssh-ed25519 AAAA... you@host\" bash provision-vps.sh" >&2
  exit 1
fi

. /etc/os-release
if [ "${ID:-}" != "ubuntu" ]; then
  echo "WARN: tested on Ubuntu only (this is $ID $VERSION_ID). Continuing." >&2
fi

export DEBIAN_FRONTEND=noninteractive

echo "[1/7] System update..."
apt-get update -qq
apt-get upgrade -y -qq

echo "[2/7] Base packages..."
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban unattended-upgrades \
  htop ncdu

echo "[3/7] Swap (${SWAP_SIZE_GB}G)..."
if [ ! -f /swapfile ]; then
  fallocate -l "${SWAP_SIZE_GB}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
  sysctl -p /etc/sysctl.d/99-swappiness.conf >/dev/null
else
  echo "  /swapfile exists, skipping"
fi

echo "[4/7] Deploy user ($DEPLOY_USER)..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER" >/dev/null
  usermod -aG sudo "$DEPLOY_USER"
fi
# Passwordless sudo for the deploy user — we rely on SSH key auth as the sole gate.
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh/authorized_keys"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
grep -qxF "$SSH_PUBKEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" || \
  echo "$SSH_PUBKEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"

echo "[5/7] SSH hardening..."
install -d -m 755 /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
# Managed by provision-vps.sh — key-only auth, no root login.
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
EOF
# Ubuntu 24.04 uses socket-activated ssh.service; reload both just in case.
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || true

echo "[6/7] Firewall + auto-patches..."
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null
# unattended-upgrades ships enabled on Ubuntu; make sure security origin is on.
dpkg-reconfigure -f noninteractive unattended-upgrades >/dev/null

echo "[7/7] Docker..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker "$DEPLOY_USER"
systemctl enable --now docker >/dev/null

# Docker-gruppens GID varierar per host (988, 999, ...). Behövs i .env.prod så
# otel-collector-containern kan läsa docker.sock via `group_add`. Vi skriver
# inte till .env.prod här (scriptet rör aldrig secrets) — vi skriver ut värdet
# så man klistrar in det vid deploy-setup.
DOCKER_GID_VALUE="$(getent group docker | cut -d: -f3)"

cat <<EOM

=== Provisioning complete ===

Host state:
  - User:       $DEPLOY_USER (sudo, key-only SSH)
  - Swap:       ${SWAP_SIZE_GB}G at /swapfile
  - Firewall:   UFW (22, 80, 443)
  - Auto-patch: unattended-upgrades
  - Docker:     $(docker --version 2>/dev/null | cut -d, -f1)
  - Docker GID: ${DOCKER_GID_VALUE}     ← lägg till i .env.prod som DOCKER_GID=${DOCKER_GID_VALUE}

Next steps (run from your workstation):

  ssh $DEPLOY_USER@<host>
  git clone https://github.com/Anome-AB/Malarkrets.git ~/malarkrets
  scp .env.prod $DEPLOY_USER@<host>:~/malarkrets/.env.prod
  ssh $DEPLOY_USER@<host> 'chmod 600 ~/malarkrets/.env.prod'
  ssh $DEPLOY_USER@<host> 'cd ~/malarkrets && docker compose -f docker-compose.prod.yml up -d'

Verify:
  curl -I https://<your-domain>/api/health

Security:
  - Root SSH login disabled.
  - Password auth disabled.
  - Only 22/80/443 open to the internet.
  - Postgres / app are reachable only inside the Docker network.
EOM
