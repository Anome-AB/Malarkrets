# RELEASE.md — Team RedFox spelbok

Intern spelbok för team RedFox (release & deploy). Laddas när Claude arbetar
med filer under RedFox ägarskap (se `TEAMS.md`).

GreenLion behöver inte läsa detta i detalj — referera hit när gränsytor
diskuteras.

## Ansvarsområde

- Bygg-pipeline (GitHub Actions → ghcr.io)
- Docker images och compose-stackar (dev + prod)
- Deploy-scripts (lokal och kommande VPS)
- Secrets och env-hantering
- Release-tagging och rollback
- Observability (health checks, loggning, backup)

## VPS-provisionering

Fresh Ubuntu 24.04-box → redo för `docker compose up` i ett steg:

```bash
SSH_PUBKEY="ssh-ed25519 AAAA... you@host" \
  bash scripts/provision-vps.sh
```

Scriptet körs som root, är idempotent, och gör:
- `deploy`-user med passwordless sudo + SSH-nyckel.
- SSH-hardening (disable root login, password auth).
- UFW öppet på 22, 80, 443.
- 2 GB swap + `vm.swappiness=10`.
- `unattended-upgrades` (security-only) + `fail2ban`.
- Docker CE + compose-plugin.

Scriptet rör **inte** repot, `.env`, eller compose — det är hostnivå
enbart. Efter provisioning: git clone + scp `<din-fylld-fil> host:~/malarkrets/.env`
+ `docker compose up`.

## Reverse proxy (Caddy)

Caddy kör som container i `docker-compose.yml`, terminerar TLS, och
proxy:ar till app:3000. Konfiguration: `Caddyfile` + två env-vars i `.env`:

- `DOMAIN` — `localhost` för lokalt test, riktigt hostnamn i prod.
- `LETSENCRYPT_EMAIL` — required när DOMAIN är riktigt hostnamn.

Med riktigt DOMAIN hämtar Caddy Let's Encrypt-cert vid första request (HTTP-01
challenge över port 80). Cert + nycklar persist:as i `caddy_data`-volymen.

App-containern exponerar `127.0.0.1:3000:3000` — bara lokal debug, aldrig
publikt. All extern trafik måste gå via Caddy.

## Pipeline-översikt

```
push master ──► .github/workflows/release.yml
                  │
                  ├─ docker build (Dockerfile, multi-stage)
                  │    build-args: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                  │
                  └─ push ghcr.io/ohman74/malarkrets:{latest, sha-<hash>}
```

Deploy (idag manuellt): `bash scripts/deploy-local.sh` pullar imagen och
startar `docker-compose.yml`.

## Rutiner

### Lägga till ny runtime env-variabel (kommer från GreenLion)

1. Bekräfta i PR att GreenLion har lagt till variabeln i `.env.example` + kod.
2. Avgör om den behövs vid **build** (t.ex. `NEXT_PUBLIC_*`) eller **runtime**.
3. **Build-tid:** lägg till i `Dockerfile` som `ARG` + `ENV`, och i
   `release.yml` som `--build-arg`. Kräver GitHub Secret.
4. **Runtime:** lägg till i `docker-compose.yml` under `environment:`
   och i `.env.prod.example`.
5. Om värdet är hemligt → GitHub Secret. Annars → committad default i
   `.env.prod.example`.
6. Verifiera genom att trigga en release och läsa bygg-loggen.

### Lägga till GitHub Secret

- CLI: `gh secret set NAMN --repo ohman74/Malarkrets`
- Webb: Settings → Secrets and variables → Actions.
- Dokumentera i `.env.prod.example` med kommentar `# set via GitHub Secret`.

### Release-tagging (semver)

Push av git-tag `vX.Y.Z` triggar release.yml och resulterar i fem taggar per
image:

```
git tag v1.2.3
git push origin v1.2.3
```

Pipelinen pushar till ghcr.io:
- `malarkrets:1.2.3`, `:1.2`, `:1`, `:sha-<hash>` (app)
- `malarkrets:migrate-1.2.3`, `:migrate-1.2`, `:migrate-1`, `:migrate-sha-<hash>`

`:latest` flyttas **inte** av en tag-push — bara av push till master. Det
gör att prod kan peka på t.ex. `:1.2` och få patch-uppdateringar automatiskt
utan att oavsiktligt plocka upp master-HEAD.

Semver-regler:
- MAJOR: breaking schema-ändring eller API-förändring som kräver koordinerad
  migration.
- MINOR: nya features, bakåtkompatibla migrationer.
- PATCH: buggfix.

### Rollback

På VPS: pinna image-tag i `.env` (eller `docker-compose.yml`) och
kör `docker compose up -d`:

```bash
# I .env (eller inline env)
APP_TAG=1.2.2
MIGRATE_TAG=migrate-1.2.2
docker compose pull
docker compose up -d
```

`app` och `migrate` MÅSTE alltid ha samma version — de körs tillsammans
och `migrate`-imagen innehåller den version av SQL-filerna som matchar
`app`-imagen. Aldrig `app:1.2.3` + `migrate:1.2.2`.

### Databas-migrationer

**Status:** Automatiska. `migrate`-tjänsten i `docker-compose.yml` kör
Drizzle-migrationer vid varje `docker compose up` och avslutar med 0 innan
app-containern startar. Implementationen:

- `scripts/migrate.mjs` kör `migrate()` från `drizzle-orm/postgres-js/migrator`
  mot `DATABASE_URL`.
- `migrate`-stage i `Dockerfile` bygger en minimal image (node:22-alpine +
  prod-deps + migrationsfiler). Pushas i release.yml som
  `ghcr.io/anome-ab/malarkrets:migrate-latest` / `:migrate-sha-<hash>`.
- `app` i compose har `depends_on: migrate: condition: service_completed_successfully`,
  så en trasig migration stoppar hela stacken (medvetet — hellre ner än
  schemadrift).

**Rollback vid trasig migration:** pinna både `app`- och `migrate`-imagen
till föregående gröna sha i `.env` (eller direkt i compose) och kör
`docker compose up -d`. Backup tas via pg_dump-cron (se TODOS).

**Prod-postgres** binder `127.0.0.1:5432:5432` — endast loopback, aldrig
internet. För DB-klient-åtkomst från workstation: SSH-tunnel.

```bash
# På workstation
ssh -L 5433:localhost:5432 deploy@malarkrets.se
# Medan SSH är uppe: anslut DBeaver/VS Code PG-extension/psql till
# localhost:5433 med credentials från .env på VPS.
```

Tunneln är SSH-key-gatad och lever bara under din session.

### Deploya lokalt från ghcr.io

Se `README.md` för user-facing steg. Internt:
`scripts/deploy-local.sh` gör pull → postgres-wait → db-probe → app →
health poll. Läs scriptet innan ändringar.

### Ladda om `.env` efter ändring

**Gotcha:** `env_file` i docker-compose läses bara vid **container-skapande**,
inte vid omstart. Följande *räcker inte* för att nya env-värden ska nå appen:
- `docker compose restart app` — behåller samma container, samma env.
- `docker compose up -d app` — återanvänder oftast existerande container.

Använd `--force-recreate` (eller full `down` + `up`):

```bash
docker compose up -d --force-recreate app
# Verifiera att nya värdet är inne:
docker compose exec app env | grep <VAR_NAME>
```

Samma gäller när env för postgres/migrate ändras — rekreera motsvarande
service.

### Env-fil-konventionen

Den körande env-filen på varje host heter **`.env`**, inget annat.

- På VPS:n: `/home/deploy/malarkrets/.env` — innehåller prod-värden.
- På staging: motsvarande fil heter `.env` (med staging-värden).
- I repo:t ligger templates under sina beskrivande namn:
  `.env.prod.example` och `.env.staging.example`. Kopiera till `.env` på
  respektive host.

Fördelen är att docker-compose:s default-beteende funkar rakt av —
`${VAR}`-interpolering i compose-filer + `env_file:`-direktivet läser
samma fil utan `--env-file`-flagga.

### Telemetri — Dash0 via OTel Collector

`otel-collector`-servicen i compose shippar traces + metrics via OTLP/HTTP
till Dash0. Instrumentering i appen görs av `@vercel/otel` (se
`src/instrumentation.ts`) och skickar till collectorn på docker-nätverket.

**Krav i `.env` på VPS:**
- `DASH0_AUTH_TOKEN` — ingestion-scoped token från Dash0-UI:t.
- `DEPLOYMENT_ENV` — `production` (eller `staging`). Taggar all telemetri.
- `DOCKER_GID` — docker-gruppens GID på *just den host:en*. Skrivs ut av
  `scripts/provision-vps.sh`. Utan den kan collectorn (som är distroless och
  kör som UID 10001) inte läsa `docker.sock` för `docker_stats`-receivern.

**Kända gotchas:**
- Contrib-imagen är distroless → `user: root` failar ("no matching entries
  in passwd"). Vi använder `group_add: ["${DOCKER_GID}"]` istället.
- `docker_stats`-receivern default:ar till Docker API 1.25; Docker 25+
  kräver minst 1.40. Vi pinnar `api_version: "1.40"` i collector-configen.
- `filelog` mot `/var/lib/docker/containers` är medvetet inte påslaget —
  mappen är mode 710 `root:root` och kräver faktisk root för att läsa.
  App-logs ska istället skickas via OTel SDK när det blir aktuellt.

## Säkerhet

- `.env` committas **aldrig** (.gitignore fångar `.env*` utom templates).
- Postgres exponerar inte port i prod-compose (förutom vid temporär dev-access).
- Google Maps-nyckel är `NEXT_PUBLIC_*` → exponeras i klient-bundeln.
  Måste restriktioneras i Google Cloud Console (HTTP referrers + API-scope +
  kvot). Se TODOS.

## Commit-konvention (RedFox)

- `ci:` — GitHub Actions workflow-ändringar
- `chore(deploy):` — deploy-scripts, compose, Dockerfile
- `chore(infra):` — infrastruktur, secrets-strategi
- `chore(dev):` — dev-only verktyg (t.ex. portmappning)
- `docs(release):` — denna fil, release-dokumentation

## Release notes / Nyheter

Användarsynliga ändringar dokumenteras i `public/release-notes.json` och
renderas på `/nyheter`. Sidan är publik och länkas från site-banner:en när
den är aktiv (under PRE-GO-LIVE med `SITE_BANNER_TEXT` satt).

### Rutin för ny release (manuellt tills vidare)

1. **Samla commits sedan förra taggen**:
   ```bash
   git log v0.1.0..HEAD --oneline
   ```

2. **Översätt till användar-språk** — grupperat i sektionerna `added`,
   `improved`, `fixed`. Plain language, undvik kod-jargon och fil-namn.
   Antingen själv eller genom att be Claude sammanfatta commits:en.

3. **Lägg till entry FÖRST i arrayen** i `public/release-notes.json`
   (nyast överst). Format:
   ```json
   {
     "version": "0.2.0",
     "date": "2026-05-XX",
     "title": "Kort titel på svenska",
     "summary": "En-mening sammanfattning.",
     "sections": {
       "added": ["..."],
       "improved": ["..."],
       "fixed": ["..."]
     }
   }
   ```
   Lämna tomma sektioner som `[]` — sidan visar bara det som har innehåll.

4. **Commit + PR + merge**.

5. **Tagga när PR är mergad**:
   ```bash
   git checkout master && git pull
   git tag -a v0.2.0 -m "Release v0.2.0"
   git push origin v0.2.0
   ```
   Pipeline (release.yml) bygger en docker-image med tag `:0.2.0`,
   `:0.2`, `:0` + migrate-motsvarigheter. Användbart vid rollback.

### Versions-schema (PRE-GO-LIVE)

- `v0.X.0` — ny feature-nivå (t.ex. forgot-password gick ut i v0.2.0)
- `v0.X.Y` — bug-fixar / småjusteringar inom samma feature-linje
- `v1.0.0` — första stabila POST-GO-LIVE-release

Detta signalerar "pre-GA, saker förändras" och ger ett tydligt kontrakt
när vi bumpar till 1.0.

### Vad ska INTE stå i release notes

Infra/CI/deploy-förbättringar, refactors, test-tillägg, dokumentation.
Allt som är osynligt för testaren utelämnas. Om det är osäkert — tumregel:
"skulle en icke-teknisk Västerås-bo förstå att det här påverkar deras
upplevelse?" Om nej → utelämna.

### Framtida automation (fas 3)

När tone är etablerad planerar vi en GitHub Action som tar `v*.*.*`-tag
→ sammanställer commits → Claude Haiku API genererar draft → PR med
uppdaterad `release-notes.json`. Human approval innan merge. Se
`TODOS.md` för status.

## Rollback (planerat)

Tills semver-tagging finns: `docker pull ghcr.io/ohman74/malarkrets:sha-<hash>`
från föregående grön release och starta om compose-stacken.

## Checklistor

### Före release (när VPS finns)
- [ ] Migrationer granskade och testade mot prod-kopia
- [ ] Secrets synkade (inga tomma värden i prod)
- [ ] Health endpoint svarar lokalt mot nya imagen
- [ ] Rollback-plan: vilken sha pekar vi tillbaka på?

### Efter release
- [ ] Pipeline grön
- [ ] `/api/health` svarar 200 på target
- [ ] Smoke: logga in, lista aktiviteter
- [ ] Release-notes uppdaterade i `public/release-notes.json` + git-tag pushad (se "Release notes / Nyheter"-sektionen ovan)

## Gränsyta mot GreenLion

Läs `TEAMS.md` för full tabell. Vanligaste flaggningsfall:
- GreenLion introducerar env-variabel → be dem tagga PR med "kräver RedFox".
- GreenLion lägger migration → be dem inkludera en kort beskrivning av
  breaking-potential i PR-texten.
