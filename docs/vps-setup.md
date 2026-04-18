# VPS-provisioneringsguide

Steg-för-steg för att gå från en blank Ubuntu 24.04-VPS till en körande
Mälarkrets-stack. Förutsätter att repot, `Caddyfile`, `docker-compose.prod.yml`
och `scripts/provision-vps.sh` finns på `master`.

## Innan du börjar (på din workstation)

**1. Ha din SSH public-nyckel redo**

```bash
cat ~/.ssh/id_ed25519.pub
# eller om du har RSA:
cat ~/.ssh/id_rsa.pub
```

Har du ingen? Generera en: `ssh-keygen -t ed25519 -C "hakan@anome.se"`.

Kopiera hela raden (`ssh-ed25519 AAAA... hakan@host`) — du klistrar in
den som `SSH_PUBKEY` i nästa steg.

**2. Ha VPS:n provisionerad hos Loopia**

- Ubuntu 24.04 LTS vald som OS.
- Root-lösenord noterat (från Loopias kontrollpanel).
- Noterat publik IPv4.

**3. (Frivilligt men bra) peka domän-A-record på IP:n nu**

Om du vill att Caddy ska kunna hämta Let's Encrypt-cert vid första
`docker compose up` behöver DNS vara satt. Tar upp till några minuter eller
timmar att propagera, så starta det tidigt.

## Ditt val: TTY eller SSH?

**TTY (Loopias webb-konsol / VNC) — rekommenderat för första körningen.**
Om något går snett med SSH-hardeningen (t.ex. nyckeln klistrades in fel)
står du inte utan åtkomst.

**SSH fungerar också** — `systemctl reload ssh` i scriptet kickar *inte* din
existerande session, den påverkar bara nya inloggningar. Men worst case
(trasig nyckel + stängd session) är att du måste gå via TTY eller
snapshot-rollback ändå.

Slutsats: **kör från TTY första gången.** Re-runs senare kan göras över SSH
som `deploy`-user med `sudo`.

## Steg-för-steg på VPS:n

**1. Logga in som root** (via Loopias konsol).

**2. Hämta scriptet.** Två alternativ:

**A) Klona repot** (om git fungerar och repot är publikt eller du har auth):
```bash
apt-get update -qq && apt-get install -y git
git clone https://github.com/Anome-AB/Malarkrets.git /tmp/repo
cd /tmp/repo
```

**B) Hämta bara scriptet** (om repot är privat och du inte vill sätta upp
git-auth som root):
```bash
# På din workstation:
scp scripts/provision-vps.sh root@<vps-ip>:/root/provision-vps.sh
```

**3. Kör provisioneringen:**

```bash
SSH_PUBKEY="ssh-ed25519 AAAA...din-nyckel... hakan@host" \
  bash scripts/provision-vps.sh
```

Tar ungefär 2-3 minuter. Scriptet är verbose — du ser varje steg (1/7 ... 7/7).

## Efter körningen — verifiera

Från din **workstation** (ny terminal, lämna TTY öppen tills det här funkar):

```bash
ssh deploy@<vps-ip>
```

Du ska komma in utan lösenord (nyckel-auth). Verifiera:

```bash
# UFW aktiv
sudo ufw status          # Status: active, 22/80/443 ALLOW

# Docker funkar utan sudo
docker ps                # tomt men inga permission-fel

# Swap aktiv
swapon --show            # /swapfile 2G

# SSH-hardening applied
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'
# -> passwordauthentication no
# -> permitrootlogin no
```

**När allt ovan stämmer kan du stänga TTY-sessionen.**

## Nästa steg efter provisionering

### 1. Klona repot som `deploy`-user

```bash
ssh deploy@<vps-ip>
git clone https://github.com/Anome-AB/Malarkrets.git ~/malarkrets
```

### 2. Skicka upp `.env` från din workstation

Env-filen ligger aldrig i git. På hosten heter den alltid `.env` —
docker compose läser den automatiskt.

```bash
# Från din workstation:
scp .env.prod deploy@malarkrets.se:~/malarkrets/.env
ssh deploy@malarkrets.se 'chmod 600 ~/malarkrets/.env'
```

Redigera `.env` på VPS:n och sätt åtminstone:

- `DOMAIN=malarkrets.se`
- `LETSENCRYPT_EMAIL=hakan.froling@anome.se`
- `AUTH_SECRET`, `POSTGRES_PASSWORD` — riktiga secrets (aldrig `CHANGE_ME`)
- `DOCKER_GID` — värdet som `scripts/provision-vps.sh` skrev ut på slutet

### 3. Logga in mot ghcr.io (engångsjobb)

Imagen är privat — Docker-daemonen måste ha en PAT sparad för att kunna
pulla. Tokenen sparas i `~/.docker/config.json` på VPS:n.

**Skapa token på GitHub:**

1. Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Namn: t.ex. `vps-ghcr-pull`
4. Scope: kryssa bara i `read:packages`
5. Kopiera tokenen — visas bara en gång

**Logga in på VPS:n:**

```bash
ssh deploy@malarkrets.se
echo "<TOKEN>" | docker login ghcr.io -u froling --password-stdin
```

### 4. Deploya med `deploy-local.sh`

```bash
ssh deploy@malarkrets.se 'cd ~/malarkrets && bash scripts/deploy-local.sh'
```

Scriptet hanterar alla steg idempotent:

1. Pre-flight (docker, compose-filer, .env, Caddyfile)
2. `git pull --ff-only` (vägrar om working tree är dirty)
3. `docker compose pull` (hämtar nya images från ghcr.io)
4. Startar postgres + väntar på `pg_isready`
5. `docker compose up -d --remove-orphans` (migrate → app → caddy via depends_on)
6. Pollar `/api/health` och visar log-tail om healthcheck failar

Första körningen tar några minuter — app- och migrate-imagen totalt
~1 GB, plus Let's Encrypt-cert-hämtning via Caddy.

### 5. Verifiera

```bash
# Från din workstation:
curl -I https://malarkrets.se/api/health
```

Ska returnera `HTTP/2 200`.

## Framtida deploys

Samma kommando som första gången:

```bash
ssh deploy@malarkrets.se 'cd ~/malarkrets && bash scripts/deploy-local.sh'
```

Scriptet pullar bara det som ändrats (appkoden via ghcr.io, compose-filer
via git). Docker recreate:ar bara containrar vars image eller config
faktiskt förändrats.

### Rollback till en specifik version

```bash
ssh deploy@malarkrets.se
cd ~/malarkrets
# Editera .env — sätt APP_TAG och MIGRATE_TAG till önskad semver
# Exempel: APP_TAG=1.2.2 MIGRATE_TAG=migrate-1.2.2
SKIP_GIT_PULL=1 bash scripts/deploy-local.sh
```

`SKIP_GIT_PULL=1` hindrar att `master` plockas in och kör över env-ändringen.

## Vanliga problem

| Symptom | Orsak | Fix |
|---|---|---|
| `ssh deploy@` frågar efter lösenord | Nyckel inte installerad rätt | TTY in som root, `cat /home/deploy/.ssh/authorized_keys` — verifiera exakt match |
| `docker: permission denied` | Deploy-user inte i docker-gruppen ännu | Logga ut + in (gruppmedlemskap laddas vid login) |
| Caddy får inte Let's Encrypt-cert | DNS pekar inte på VPS ännu, eller port 80 är blockerad | `dig malarkrets.se` + `sudo ufw status` |
| `docker compose pull` failar med `unauthorized` | ghcr.io-imagen är privat | `docker login ghcr.io` med GitHub PAT med `read:packages` |
| `deploy-local.sh`: "Lokala ändringar finns i arbetsträdet" | Någon har hand-editerat filer på VPS:n | `git status` för att se vad, sedan `git stash` eller `git checkout .` för att kasta |
| `deploy-local.sh`: healthcheck timeouts efter 60s | App kommer inte upp | Scriptet tailar `app` och `migrate`-loggar automatiskt — läs dem för orsak |
| "Caddyfile saknas" vid deploy | Repot inte klonat, eller fel arbetskatalog | Kör scriptet från `~/malarkrets` (eller var repot ligger) |

## Om något går helt snett

Scriptet är idempotent — kör om det. Det bygger inte upp dubbla users,
dubbla UFW-regler, eller dubbla swap-filer.

Sista utvägen: Loopia har snapshot/backup i kontrollpanelen. Ta en
snapshot **före** första körningen, rulla tillbaka om det behövs.

## Flytta till annan VPS-leverantör

Hela poängen med setupen är att den är portabel. För att flytta till
Hetzner, DigitalOcean eller liknande:

1. Provisionera ny Ubuntu 24.04-box hos den nya leverantören.
2. Kör samma `provision-vps.sh` med samma `SSH_PUBKEY`.
3. Klona repot, kopiera upp `.env`, `docker login ghcr.io`.
4. Kör `bash scripts/deploy-local.sh` på nya VPS:n.
5. `pg_dump` på gamla VPS:n, `psql < dump.sql` på nya.
6. Kopiera `caddy_data`-volymen (eller låt Caddy hämta nytt cert).
7. Peka om DNS A-record till nya IP:n.

Räkna med 1-2 timmar inklusive DNS-propagering. Allt gör samma script
— samma kommando som vid första deploy och varje vanlig uppdatering.
