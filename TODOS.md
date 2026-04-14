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

## Backlog

### Observability / Operations
- Backup-strategi för PostgreSQL (pg_dump cron) — S
- ~~Health check endpoint `/api/health`~~ KLAR (b69a227, 2026-04-14)
- Strukturerad loggning (pino eller winston) — S

### Docker
- ~~Docker Desktop på Windows har en bugg med inference manager socket.~~ LÖST: Docker Desktop v28.4.0 fungerar (verifierat 2026-04-14).

### För Fredrik — GitHub-kontoägare (blockerande)
- **Lägg till GitHub Secret `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** i repot ohman74/Malarkrets.
  - Via CLI: `gh secret set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY --repo ohman74/Malarkrets`
  - Eller webben: Settings → Secrets and variables → Actions → New repository secret.
  - Pipelinen (release.yml) och Dockerfile är redan förberedda att ta emot nyckeln som build-arg och baka in den i klient-bundeln. Utan detta secret kommer kartor i den byggda imagen att rendera utan nyckel (gråa/"for development purposes only").
- **Restriktera nyckeln i Google Cloud Console** innan den används:
  - HTTP referrers: produktionsdomän + `http://localhost:3000/*`.
  - API restrictions: endast Maps JavaScript API + Maps Static API.
  - Sätt dygns-/månadskvot så stulen nyckel inte kan debiteras oändligt.
- Om ni har fler hemligheter (SMTP, VPS SSH-nyckel osv) — lägg dem som secrets samtidigt, säg till så uppdaterar vi pipelinen.

### Release Pipeline (tillagt av /plan-eng-review 2026-04-14)
- **Semver image-tagging:** Lägg till stöd för git tags (v1.0.0) som triggar GitHub Actions att tagga Docker-imagen med versionsnummer. Krävs för rollback på VPS. Insats: S. Beror på: pipeline finns.
- **VPS-deploy i pipeline:** Lägg till SSH-deploy-steg i release.yml som kör docker compose pull + up på extern server. 15 rader YAML + 3 GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY). Insats: S. Beror på: pipeline + VPS finns.
