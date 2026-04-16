# TODOS — Mälarkrets

## Nästa session — Prioritet 1

### Design-genomgång av aktivitetsdetaljsidan — KLAR
**Fixat av:** /design-consultation + /design-review 2026-04-01
- Typografi: Satoshi (display) + Instrument Sans (body), Inter borttagen
- Koppar-accent #c4956a, info-färg #4a7c94 tillagda
- Spacing fixad till ren 4px-grid
- Solo-badge borttagen från feedkort (noise-reduktion)
- Landing hero tightened med extra subtitle
- Deltagare-text ändrad från grön till grå (inte länk-förvirring)
- Formulär-labels använder nu Satoshi
- Aktivitetsdetaljens sidebar nu sticky på desktop

### Hierarkiska intressetaggar (Stor feature)
**Vad:** Träd-struktur för intressen med kategorier och undertaggar.
**Varför:** Lång platt lista i sidomenyn är svårnavigerad. Användare vill kunna välja "Friluftsliv" och automatiskt matcha alla undertaggar.
**Schema-ändring:**
- `interest_tags` behöver: `parent_id` (FK self-referencing, nullable), `depth` (integer)
- Toppnivå: Friluftsliv, Sport, Kreativt, Spel & Hobby, Motion & Hälsa, Socialt, Kultur
- Undernivå: Vandring → Stadsvandring, Fjällvandring. Jakt → Pilbågsjakt, Storviltsjakt, etc.
**UI-ändring:**
- Sidebar: kollapsibla kategorier istället för platt lista
- Onboarding: välja kategori → expandera undertaggar
- Feed-matchning: välja en kategori matchar alla dess undertaggar
**Insats:** M-L (schema-migration, seed-omskrivning, 3-4 UI-komponenter)

## Nästa session — Prioritet 2

### Sliding panel / overlay för aktivitetsdetalj (Desktop UX)
**Vad:** Aktivitetsdetalj öppnas som en glidande panel från höger på desktop, istället för full-page navigation.
**Varför:** Wireframe specificerade detta. Bättre UX — användaren behåller feedkontexten.
**Implementation:**
- Client-side state i feed-sidan: `selectedActivityId`
- Klick på kort → sätter selectedActivityId → panelen glider in
- Panel: 420px bredd, overlay med bakgrundsblur
- Kräver: focus trap, Escape stänger, animering
**Insats:** M (primärt frontend, ingen schema-ändring)

### Datum/tid-picker för desktop
**Vad:** Native `datetime-local` input fungerar dåligt på desktop. Scroll-baserad tid-väljare är mobiloptimerad.
**Varför:** Desktop-användare förväntar sig att kunna klicka/skriva tid, inte scrolla.
**Lösning:** Anpassad kalender-komponent eller bibliotek (react-datepicker, @radix-ui/date-picker).
**Insats:** S-M

### Profilbild-uppladdning
**Vad:** Profilen saknar uppladdning av profilbild.
**Varför:** Sharp + MinIO redan konfigurerat för aktivitetsbilder, samma pipeline kan återanvändas.
**Insats:** S

### Flervals-intressefilter
**Vad:** Sidebar tillåter bara ett intresse åt gången som filter. Borde stödja flera.
**Varför:** "Visa vandring OCH fotografi" är ett naturligt användningsmönster.
**Insats:** S (query stödjer redan tagFilter, behöver bara multi-select UI)

### Återkommande aktiviteter (MVP + framtida per-instans-override)
**Vad:** Låt skapare markera en aktivitet som återkommande (dagligen / veckovis / månadsvis) med start- och slutdatum. Systemet genererar alla instanser upfront. Feeden visar bara nästa kommande instans per serie.

**Varför:** Klassiskt mönster för lokalsamhälles-appar (löpargrupp varje onsdag, brädspel första torsdagen i månaden osv.). Utan stöd tvingas skapare dubbelposta manuellt, vilket skräpar ner flödet.

**Produktbeslut (office hours):**
- MVP = hela serien redigeras/avbokas som en enhet. Skippa per-instans-override nu, men designa schemat så det går att lägga till senare.
- Skippa "flera dagar samma vecka i samma aktivitet". Tisdag + torsdag skapas som två separata serier. Samma UX-resultat, hälften så komplex kod.
- Cap på max 52 tillfällen / 12 mån per serie.

**Arkitektur (eng review) — Alternativ A: explicita instanser med series_id:**
- Ny tabell `activity_series`: `id`, `creator_id`, `frequency` enum(daily|weekly|monthly), `start_date`, `end_date`, `weekday` int (för weekly), `created_at`.
- Lägg till `series_id` uuid nullable FK + index på `activities`.
- Vid seriens skapande: generera alla rader i `activities` upfront, länkade via `series_id`.
- Alternativ B (on-demand materialisering) förkastades — komplex hybrid-state, svårt att joina "nästa tillfälle" korrekt.
- Feed-query: `DISTINCT ON (COALESCE(series_id, id))` sorterat på `start_time` där `start_time > now()` → visar nästa kommande per serie. Aktiviteter utan `series_id` visas som idag. "Nästa efter passerat" faller ut naturligt eftersom feeden redan filtrerar framtida tider.
- Edit/cancel/delete: alla framtida instanser i serien uppdateras, passerade instanser rörs inte.
- Participants per-instans (man anmäler sig till ett specifikt tillfälle, inte hela serien).

**UI (design review):**
- **Skapa-formulär:** toggle "Återkommande aktivitet". När på: frekvens-dropdown + slutdatum ELLER antal tillfällen (välj en). Starttid fortsätter gälla för alla instanser.
- **Feed-kort:** lågmäld ↻-ikon vid datum-raden + sub-text `Varje onsdag · 12 tillfällen kvar`. Ingen ny färg, ingen extra visuell vikt.
- **Detaljsida:** info-rad högst upp `Del av en serie · Varje onsdag · Se alla tillfällen →`.
- **Edit-sida:** info-banner i admin-stil: `Ändringar gäller alla kommande tillfällen i serien`. Per-instans-override kommer i v2.

**Insats:** M-L (schema-migration, server actions för serieskapande + edit/cancel av framtida instanser, feed-query-uppdatering, 2-3 UI-komponenter, migration-skript).

**v2 — per-instans-override:** Lägg till `modified_from_series` boolean på `activities`. Edit av en enskild instans sätter flaggan och slutar följa serieändringar. Edit av serien hoppar över modifierade instanser. Cancel av en instans = bara den raden. Ingen ny schema-ändring krävs utöver den flaggan.

## Säkerhetshärdning (security review 2026-04-17)

### HIGH — Seed skapar admin med känt lösenord, körbar i prod
- **Vad:** `src/db/seed.ts` skapar `testadmin1@malarkrets.se` med lösenord `testm`. Seed-containern finns i `docker-compose.prod.yml` och kan köras mot prod.
- **Fix:** Lägg till miljöguard i seed.ts som vägrar köra när `NODE_ENV=production` eller liknande. Alternativt: kräv en explicit `SEED_CONFIRM=yes` env-variabel.
- **Insats:** S
- **Ägs av:** GreenLion (seed.ts) + RedFox (compose)

### HIGH — Postgres-port exponerad i prod-compose
- **Vad:** `127.0.0.1:5433:5432` finns kvar i `docker-compose.prod.yml` med kommentaren "REMOVE before VPS deploy". Kommentar-baserad säkerhet är skört.
- **Fix:** Ta bort `ports`-blocket helt. Skapa separat `docker-compose.override.yml` (gitignored) för lokal databasåtkomst. Använd SSH-tunnel eller `docker compose exec` i prod.
- **Insats:** S

### HIGH — Placeholder AUTH_SECRET i staging
- **Vad:** `.env.staging.example` har `AUTH_SECRET=CHANGE_ME_...`. Om staging körs med detta värde kan vem som helst förfalska sessioner.
- **Fix:** Generera riktigt AUTH_SECRET även i staging. Eventuellt: startup-check i appen som vägrar starta om AUTH_SECRET innehåller `CHANGE_ME`.
- **Insats:** S
- **Ägs av:** GreenLion (app-check) + RedFox (env-mall)

### MEDIUM — MinIO-konsol exponerad på host
- **Vad:** Port 9000/9001 binds till `127.0.0.1` i prod-compose. Nåbar via SSRF eller annan process på host.
- **Fix:** Ta bort `ports` i prod. Appen når MinIO via Docker-nätverket (`minio:9000`). Admin via SSH-tunnel.
- **Insats:** S

### MEDIUM — Migrate/seed kör som root
- **Vad:** `runner`-stage har non-root user, men `migrate` och `seed` kör som root.
- **Fix:** Lägg till non-root user i migrate/seed-stages i Dockerfile.
- **Insats:** S

### MEDIUM — Caddy healthcheck pekar fel
- **Vad:** Healthcheck `wget http://localhost:3000/api/health` — port 3000 finns inte inuti Caddy-containern. Checken misslyckas alltid.
- **Fix:** Ändra till `wget http://localhost:80/` eller `caddy validate`.
- **Insats:** S

### MEDIUM — Saknar Content-Security-Policy och X-Frame-Options
- **Vad:** Caddyfile har HSTS och X-Content-Type-Options men saknar CSP och frame-skydd.
- **Fix:** Lägg till `X-Frame-Options DENY` och en CSP-policy anpassad för appen (inkl. Google Maps-origins).
- **Insats:** S-M
- **Ägs av:** RedFox (Caddyfile)

### MEDIUM — Google Maps API-nyckel i image-layer metadata
- **Vad:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` lagras som ARG/ENV i builder-stage. Nåbar via `docker inspect` om imagen är publikt tillgänglig.
- **Fix:** Säkerställ att GHCR-paketet är privat. Restriktera nyckeln med HTTP referrer i Google Cloud Console (se Fredrik-TODO nedan).
- **Insats:** S

## Backlog

### Env-config: en enda källa för alla tjänster
- **Vad:** `docker-compose.prod.yml` har `env_file: .env.prod` på `app` och `migrate`, men `postgres` och `minio` läser lösenord via `${VAR:-default}` shell-interpolering. Det gör att `.env.prod`-värden ignoreras av dessa tjänster och default-lösenord används istället.
- **Snabbfix (gjord 2026-04-16):** Lade till `env_file: .env.prod` på `postgres` och `minio` så alla tjänster läser från samma källa.
- **Kvar att göra:** Rensa bort `${VAR:-default}` fallbacks i compose `environment:`-blocken så det inte finns två ställen som sätter samma variabel. `.env.prod` ska vara den enda källan.
- **Insats:** S

### Observability / Operations
- Backup-strategi för PostgreSQL (pg_dump cron) — S
- ~~Health check endpoint `/api/health`~~ KLAR (b69a227, 2026-04-14)
- Strukturerad loggning (pino eller winston) — S

### Docker
- ~~Docker Desktop på Windows har en bugg med inference manager socket.~~ LÖST: Docker Desktop v28.4.0 fungerar (verifierat 2026-04-14).

### För Fredrik — GitHub-kontoägare
- ~~**Lägg till GitHub Secret `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`**~~ KLAR 2026-04-15. Satt på Anome-AB/Malarkrets, plockas upp av release.yml + Dockerfile som build-arg.
- **Restriktera nyckeln i Google Cloud Console**:
  - ✅ HTTP referrers begränsade till localhost (2026-04-15) — säker som GitHub Secret tills prod-domän är bestämd.
  - ⏳ Prod-domän är `malarkrets.se` — lägg till som tillåten referrer, annars renderar kartor i prod som gråa/"for development purposes only".
  - ⏳ API restrictions: sätt till endast Maps JavaScript API + Maps Static API.
  - ⏳ Dygns-/månadskvot så stulen nyckel inte kan debiteras oändligt.
- Om ni har fler hemligheter (SMTP, VPS SSH-nyckel osv) — lägg dem som secrets samtidigt, säg till så uppdaterar vi pipelinen.

### Release Pipeline (tillagt av /plan-eng-review 2026-04-14)
- ~~**Semver image-tagging**~~ KLAR 2026-04-15. `git tag vX.Y.Z && git push --tags` genererar `:X.Y.Z`, `:X.Y`, `:X` + migrate-motsvarigheter. `:latest` flyttas bara av master-push. Compose stödjer `APP_TAG` / `MIGRATE_TAG` env-override för rollback.
- **VPS-deploy i pipeline:** Lägg till SSH-deploy-steg i release.yml som kör docker compose pull + up på extern server. 15 rader YAML + 3 GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY). Insats: S. Beror på: pipeline + VPS finns.

### VPS-leverantör: Loopia (beslut 2026-04-15)
- 2 GB RAM / 50 GB HDD, 460 kr/mån ex moms.
- **Motivering:** Lokal i Västerås (passar produktens varumärke), GDPR-enkelt, SLA under svensk lag, svensk support/faktura.
- **Uppgraderingsväg:** 4 GB om RAM > 80% ihållande eller CPU-bundet (Sharp-bildresize under last).
- **Exit-plan:** docker-compose-stacken är portabel. Flytt till Hetzner/DO ≈ 1h jobb (provisionera + kopiera compose + restore pg_dump).
- **Verifiera med Loopia innan köp:** CPU-cores (minst 1 vCPU, helst 2), bandbredd/månad, snapshot/backup-möjlighet, Ubuntu LTS som OS.
- **Provisioning-checklista (när VPS är bokad):**
  1. Ubuntu 24.04 LTS (eller Debian 12 som fallback).
  2. Lägg till 2 GB swapfile (`fallocate -l 2G /swapfile …`).
  3. Skapa non-root user, SSH-nyckel-only, disable password-login.
  4. UFW: öppna 22, 80, 443.
  5. Installera Docker + Docker Compose plugin.
  6. Caddy eller Nginx som reverse proxy (Let's Encrypt automatiskt via Caddy).
  7. Klona repot + `.env.prod` (scp:a från säker plats, ligger inte i git).
  8. `docker compose -f docker-compose.prod.yml up -d` + healthcheck-verifiering.
  9. Sätt upp `pg_dump` cron → dumpa till extern plats (Loopia backup-tjänst eller Backblaze B2).
  10. ~~Ta bort `127.0.0.1:5433:5432`-mappningen från compose-filen innan deploy (dev-only).~~ → Se säkerhetshärdning ovan: ta bort postgres + minio ports helt från prod-compose.

- **Automatiska DB-migrationer vid deploy** — KLAR 2026-04-15 (alternativ 2 valt).
  - Init-container `migrate` i `docker-compose.prod.yml` kör Drizzle-migrationer
    via `scripts/migrate.mjs` (programmatic `migrate()` från
    `drizzle-orm/postgres-js/migrator`) och exit:ar innan app-containern startar.
  - Separat `migrate`-stage i `Dockerfile` + extra build-push-steg i
    `release.yml` → `ghcr.io/anome-ab/malarkrets:migrate-latest`.
  - GreenLion-synk kvar: granska `scripts/migrate.mjs` (GreenLion-ägt område)
    när teamet är tillbaka. Inga API-förändringar, men framtida migrations-PR:er
    körs nu automatiskt vid deploy, det bör de veta om.
