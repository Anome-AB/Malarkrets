# TODOS — Mälarkrets

## Release-tillstånd

**Nuvarande: PRE-GO-LIVE** (aktiv utvärdering, inga riktiga kunder).

Denna TODO-lista har två lägen. Vissa åtgärder aktiveras eller avaktiveras beroende på läge. Flippen från PRE till POST är ett **medvetet beslut** — kopplat till första riktiga kunden — inte något som bara glider förbi.

### PRE-GO-LIVE (nuvarande)
- Dataförlust är acceptabel (ingen kund har riktig data ännu).
- Downtime är acceptabel (vi kan wipa & bygga om när vi vill).
- Strategi: *cattle not pets* — VPS ska kunna återställas från noll via provisioning + backup.
- Ephemeral runtime-state-skydd behövs inte.
- `AUTH_SECRET=CHANGE_ME` i staging är ett irritationsmoment, inte en säkerhetsrisk.

### POST-GO-LIVE — checklista som måste vara avbockad *innan* flippen
Obs: flera punkter måste påbörjas i god tid före flipp-datum, de är inte efterstädning.

- [ ] Restic + B2-backup verifierad via minst en lyckad restore-övning på staging ("cattle drill").
- [ ] RTO-siffra uppmätt och dokumenterad (hur lång tid tar wipe & rebuild?).
- [ ] RPO-siffra beslutad och acceptabel (dagligen = 24 h; timvis om kunden kräver).
- [ ] Köpt TLS-cert installerat (ersätter Let's Encrypt auto-provisioning, se RedFox-TODO).
- [ ] Daglig backup-schemaläggning har kört utan fel i minst en vecka.
- [ ] Alla HIGH-säkerhetsobjekt under "Säkerhetshärdning" avbockade.
- [ ] In-flight-jobb / sessions / webhook-delivery — beslut taget (redundans? acceptera förlust?).
- [ ] Monitoring + alerts på VPS-uptime, disk-space, postgres-health.
- [ ] Kontaktväg/rutin när något går sönder kl 03:00 på natten.
- [ ] GDPR-rutiner: logg-retention, rätten att bli glömd, personuppgiftsbiträdesavtal med Loopia/B2.

### POST-GO-LIVE — parking lot (lägg till nya items här efter flippen)
- **Strama till CSP.** Nuvarande policy tillåter `'unsafe-inline'` +
  `'unsafe-eval'` i `script-src` (Next.js 16-krav) och `https:`-wildcard i
  `img-src`. Efter go-live: byt till nonce-baserade scripts via Next.js-
  middleware, och ersätt `https:` i img-src med konkreta domäner användare
  faktiskt laddar bilder från.

- **Normalisera migrations-journalens tidsstämplar.** idx 4, 5 och 7 i
  `src/db/migrations/meta/_journal.json` har hand-editerade framtida
  timestamps (juni 2026) från tidigare merge-konflikter. 0008 fick
  manuellt bumpas för att passera dem. CI-checken (`scripts/check-migration-journal.mjs`)
  förhindrar återfall för nya migrationer, men den "high-water mark"
  på 1781942400000 (2026-06-20) kommer följa med fram till dess real-tid
  catchar upp — varje ny migration genererad med `Date.now()` innan dess
  kommer CI-failar tills man manuellt bumpar `when`. Fix är tvåstegs:
  (1) normalisera _journal.json till plausibla naturliga timestamps,
  (2) kör DB-surgery på varje miljö (lokal, staging, VPS, GreenLions maskin)
  för att uppdatera `drizzle.__drizzle_migrations.created_at` till
  matchande värden. Cosmetisk men gör att framtida migrationer "bara
  funkar" utan bump-danser.

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
**Varför:** Sharp redan konfigurerat för aktivitetsbilder, samma pipeline kan återanvändas.
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

### "Visa alla" för vanliga användare (feed-filtrering)
**Vad:** Idag har bara admins en "Visa alla"-toggle som bypassar intresse-matchningen. Vanliga användare ska också få välja "Visa alla", men deras vy ska fortfarande respektera hårda begränsningar.

**Regler för vanlig "Visa alla":**
- Filtrera bort aktiviteter som är könsbegränsade till ett kön användaren inte matchar (t.ex. man eller ej_angett ser inte "endast kvinnor"-aktiviteter).
- Filtrera bort aktiviteter med `minAge` satt om användarens `birthDate` saknas, eller användaren är yngre än `minAge`.
- Admin-toggeln ska fortsätta visa allt (inklusive det som filtreras för vanliga användare).

**Insats:** S (bara query-predikat i `getMatchedActivities`, UI-toggeln speglas från admin-varianten).

### Populära aktiviteter på startsidan: filtrera könsbegränsade
**Vad:** "Populära aktiviteter"-sektionen på landningssidan (för icke-inloggade) visar alla aktiviteter. Exkludera könsbegränsade så att den anonyma vyn inte exponerar "endast kvinnor"/"endast män"-aktiviteter för folk vi inte vet vilka är.

**Insats:** XS (en rad i den query som bygger populära).

### Glömt lösenord (inloggningssidan)
**Vad:** Länk "Glömt lösenord?" på login. Klick öppnar ett formulär för e-post. Vid submit: om adressen finns, skicka återställnings-mail med en token (giltig en timme). Länken i mailet leder till `/reset-password?token=...` där användaren sätter nytt lösenord.

**Standardflöde:**
- Ny kolumn `password_reset_token` + `password_reset_expires_at` på `users` (eller återanvänd `email_verification_token`-mönstret i separat tabell).
- Server action: ingen information om e-posten finns eller ej i responsen (läckage-förebyggande).
- Mail via samma pipeline som `email_verification_token` använder idag.
- Token hashas i databasen (inte klartext).

**Frågor innan bygget:**
- Använder vi nuvarande mail-avsändare (SMTP via env-vars?) eller ska vi byta? RedFox-synk om extern tjänst.
- Ska vi återanvända `email_verification_token`-kolumnen eller ha separata? Separata är tydligare men en kolumn till per user.
- Rate-limit på submit (undvik att skicka 1000 mail / minut till samma adress)?

**Insats:** M (schema + migration + action + mail-template + två sidor + token-TTL-hantering).

### Profil-layout: tomt utrymme under "Spara ändringar"
**Vad:** I "Personlig information"-kortet blir det mycket vertikal tomyta under Spara-knappen. Grid-kolumnen ("Mina intressen") till höger är längre.

**Förslag:** Antingen flytta upp några av Mina intressen-delarna på vänster sida (avatar-upload, om den kommer in), eller låt personlig-info-kortet växa genom att lägga till ytterligare fält (t.ex. "Om mig"-bio för framtiden). Alternativt grid-collapse med `items-start` så korten inte tvingas ha samma höjd, vilket redan är default, så det är snarare en längd-obalans.

**Insats:** XS (CSS/design-beslut).

### Blockera användare (behöver eng review innan bygget)
Ramverket i schema:t finns redan (`user_blocks`-tabell), men den används inte. Den här feature:n rör feed-filtrering, kommentarsvyn, aktivitetskort, och kräver ett designbeslut för varje touchpoint.

**Funktionella krav:**
1. **Deltagarlista på aktivitetssidan** med möjlighet att blockera en deltagare därifrån.
2. **Blockera från kommentarsfält:** menyåtgärd på varje kommentar (tre-punkts-meny) med "Blockera användare".
3. **Bekräftelse före blockering:** modal med förklaring av konsekvenserna (se listan nedan) innan blockeringen effektueras. Inte tyst klick-och-klart.
4. **Kommentarer från blockerad användare:** visa att en kommentar existerar men sudda ut innehållet ("Kommentar från blockerad användare" + grå bakgrund), inte helt dolt så tråden inte ser trasig ut.
5. **Blockerad ser inte mina aktiviteter:** filtrera i feed-query för blockeraren.
6. **Jag ser inte deras aktiviteter:** symmetriskt filter.
7. **Aktivitet där blockerad anmält sig:** tydlig visuell indikering på aktivitetskortet (röd ram, varningsikon, eller ett badge i stil med könsrestriktionsikonen men i varningsfärg). Designval öppet.

**Öppna frågor till eng/design review:**
- Ska blockerade användare få en notis om att de blockerats? (Default: nej, tyst.)
- Vad händer om en blockerad användare redan är med i en aktivitet som jag skapar? Kick-ut vid blockeringstillfället, eller bara dölj från min vy? Konsekvens för dem: de får ingen notis om att aktiviteten ställs in, men kan inte interagera.
- Ska blockeringen vara permanent eller tidsbegränsad? Default permanent, med "avblockera"-knapp i profilen (redan wire:at i schema:t).
- Hur hanterar vi en situation där två användare blockerar varandra (ingen av dem ser den andra)? Förmodligen ingen special-logik behövs, bara transitiv filtrering.
- Admin-undantag: ska admins kunna se blockerade användare för moderationsändamål? Troligt ja.

**Insats:** L (multi-touchpoint: feed-query, comment-rendering, activity-card-prop, ny modal, ny deltagarlista-UI, card-flagga för blockerad-deltagare, audit-trail?).

## Säkerhetshärdning (security review 2026-04-17)

### HIGH — Seed skapar admin med känt lösenord, körbar i prod
- **Vad:** `src/db/seed.ts` skapar `testadmin1@malarkrets.se` med lösenord `testm`. Seed-containern finns i `docker-compose.yml` och kan köras mot prod.
- **Fix:** Lägg till miljöguard i seed.ts som vägrar köra när `NODE_ENV=production` eller liknande. Alternativt: kräv en explicit `SEED_CONFIRM=yes` env-variabel.
- **Insats:** S
- **Ägs av:** GreenLion (seed.ts) + RedFox (compose)

### ~~HIGH — Postgres-port exponerad i prod-compose~~ (omvärderad 2026-04-18)
- **Tidigare oro:** `127.0.0.1:5433:5432` i `docker-compose.yml` med kommentaren "REMOVE before VPS deploy" — kommentar-baserad säkerhet är skört.
- **Nytt beslut:** Bindning kvar men på `127.0.0.1:5432:5432` (explicit loopback). Aldrig internet-exponerad. Används via SSH-tunnel från workstation för DB-klient-åtkomst. Dokumenterat i RELEASE.md. UFW blockerar ändå allt utom 22/80/443, så även om någon råkade byta `127.0.0.1` → `0.0.0.0` skulle brandväggen ta emot.

### HIGH — Placeholder AUTH_SECRET i staging
- **Vad:** `.env.staging.example` har `AUTH_SECRET=CHANGE_ME_...`. Om staging körs med detta värde kan vem som helst förfalska sessioner.
- **Fix:** Generera riktigt AUTH_SECRET även i staging. Eventuellt: startup-check i appen som vägrar starta om AUTH_SECRET innehåller `CHANGE_ME`.
- **Insats:** S
- **Ägs av:** GreenLion (app-check) + RedFox (env-mall)

### ~~MEDIUM — Migrate/seed kör som root~~ KLAR 2026-04-18
- Non-root `nextjs:nodejs` (uid/gid 1001) tillagt i både `migrate`- och
  `seed`-stages i Dockerfile. Matchar `runner`-stagen.

### ~~MEDIUM — Caddy healthcheck pekar fel~~ KLAR 2026-04-18
- Healthcheck pekar nu på `http://app:3000/api/health` via docker-nätverket
  istället för den omöjliga `localhost:3000` inuti Caddy-containern. Testar
  faktiskt hela kedjan Caddy behöver för att kunna serva trafik.

### ~~MEDIUM — Saknar Content-Security-Policy och X-Frame-Options~~ KLAR 2026-04-18
- `X-Frame-Options: DENY` + CSP tillagt i Caddyfile.
- **Medveten kompromiss:** CSP tillåter `'unsafe-inline'` + `'unsafe-eval'`
  på `script-src` (krävs av Next.js 16 runtime) och `https:` wildcard på
  `img-src`. Härdning via nonces + specifika CDN-origins är en POST-GO-LIVE-
  uppgift, se parking lot.

### MEDIUM — Google Maps API-nyckel i image-layer metadata
- **Vad:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` lagras som ARG/ENV i builder-stage. Nåbar via `docker inspect` om imagen är publikt tillgänglig.
- **Fix:** Säkerställ att GHCR-paketet är privat. Restriktera nyckeln med HTTP referrer i Google Cloud Console (se Fredrik-TODO nedan).
- **Insats:** S

## Backlog

### Env-config: en enda källa för alla tjänster
- **Vad:** `docker-compose.yml` har `env_file: .env.prod` på `app` och `migrate`, men `postgres` läser lösenord via `${VAR:-default}` shell-interpolering. Det gör att `.env.prod`-värden ignoreras av denna tjänst och default-lösenord används istället.
- **Snabbfix (gjord 2026-04-16):** Lade till `env_file: .env.prod` på `postgres` så alla tjänster läser från samma källa.
- **Kvar att göra:** Rensa bort `${VAR:-default}` fallbacks i compose `environment:`-blocken så det inte finns två ställen som sätter samma variabel. `.env.prod` ska vara den enda källan.
- **Insats:** S

### Observability / Operations
- Backup-strategi för PostgreSQL (pg_dump cron) — S
- ~~Health check endpoint `/api/health`~~ KLAR (b69a227, 2026-04-14)
- Strukturerad loggning (pino eller winston) — S

### Secrets management (tillagt efter /plan-eng-review 2026-04-19)
**Kontext:** Runtime-secrets (DATABASE_URL, AUTH_SECRET, RESEND_API_KEY, DASH0_AUTH_TOKEN m.fl.) ligger idag i `.env` på VPS:n, mode 0600, läst via `env_file:` i compose. Det är rätt hem för runtime-secrets — de ska inte till GitHub Secrets där de skulle blanda sig med CI-flödet och hamna i image-metadata. Build-time-secrets som `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ligger redan korrekt i GitHub Secrets. Men nuvarande setup har tre svagheter som behöver adresseras innan go-live:

- **Krypterad backup av `.env` tillsammans med pg_dump** — S. POST-GO-LIVE-förberedelse.
  - Idag: `.env` på VPS är skyddad av filpermissions, men om/när backup-strategin (ovan, Observability) landar måste `.env`-kopian också skyddas — en klartext-backup av `.env` på B2 är en läcka.
  - Lösning: kryptera med `age --encrypt -r <public-key> .env > env-backup.age` i backup-scriptet. Privata nyckeln förvaras utanför VPS:n (password manager + offline-kopia).
  - Beror på: backup-strategin.

- **Rotations-runbook i RELEASE.md** — S. POST-GO-LIVE-dokumentation.
  - Idag finns ingen dokumenterad process för att rotera AUTH_SECRET (alla sessioner invalideras), POSTGRES_PASSWORD (kräver DB-side update + env-update + restart), RESEND_API_KEY (ny key i Resend UI → .env → restart app).
  - Värt att skriva innan behovet uppstår — en engångs-operation på tre rader skapar ett prejudikat. Tar 30 minuter när det görs som förberedelse, flera timmar i panikläge under ett äkta incident.

- **Synka `.env`-värdena till en password manager** — XS. Gör nu.
  - Idag: värdena finns bara på VPS:n. Om VPS:en dör oåterkalleligt och backup är korrupt finns ingen kopia.
  - Kopiera till 1Password/Bitwarden/liknande med tydlig naming (`mälarkrets-prod-env-YYYY-MM-DD`). Uppdatera vid varje rotation.

- **(Framtida)** SOPS + age för version-kontroll av `.env` — M. Inte akut.
  - Om/när ni har flera miljöer (staging + prod + dev-per-person) eller flera personer hanterar secrets kan `sops` ge er krypterat-i-git med diff-historik. Overkill nu, värt att ta fram när ni har 2+ miljöer.

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
- **VPS-deploy i pipeline:** Lägg till SSH-deploy-steg i release.yml som kör docker compose pull + up på extern server. 15 rader YAML + 3 GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY) — dessa är deploy-time-secrets och hör hemma i GitHub Secrets (inte .env), se "Secrets management"-sektionen för distinktion. Insats: S. Beror på: pipeline + VPS finns.

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
  8. `docker compose up -d` + healthcheck-verifiering.
  9. Sätt upp `pg_dump` cron → dumpa till extern plats (Loopia backup-tjänst eller Backblaze B2).
  10. ~~Ta bort `127.0.0.1:5433:5432`-mappningen från compose-filen innan deploy (dev-only).~~ → Se säkerhetshärdning ovan: ta bort postgres ports helt från prod-compose.

- **Automatiska DB-migrationer vid deploy** — KLAR 2026-04-15 (alternativ 2 valt).
  - Init-container `migrate` i `docker-compose.yml` kör Drizzle-migrationer
    via `scripts/migrate.mjs` (programmatic `migrate()` från
    `drizzle-orm/postgres-js/migrator`) och exit:ar innan app-containern startar.
  - Separat `migrate`-stage i `Dockerfile` + extra build-push-steg i
    `release.yml` → `ghcr.io/anome-ab/malarkrets:migrate-latest`.
  - GreenLion-synk kvar: granska `scripts/migrate.mjs` (GreenLion-ägt område)
    när teamet är tillbaka. Inga API-förändringar, men framtida migrations-PR:er
    körs nu automatiskt vid deploy, det bör de veta om.
