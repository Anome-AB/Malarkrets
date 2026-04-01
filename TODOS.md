# TODOS — Mälarkrets

## Next Session Priority

### Hierarkiska intressetaggar (Stor feature)
**Vad:** Träd-struktur för intressen med kategorier och undertaggar.
**Varför:** Lång platt lista i sidomenyn är svårnavigerad. Användare vill kunna välja "Friluftsliv" och automatiskt matcha alla undertaggar.
**Schema-ändring:**
- `interest_tags` behöver: `parent_id` (FK self-referencing, nullable), `depth` (integer)
- Toppnivå: Friluftsliv, Sport, Kreativt, Spel & Hobby, Motion & Hälsa, Socialt, Kultur
- Undervivå: Vandring → Stadsvandring, Fjällvandring. Jakt → Pilbågsjakt, Storviltsjakt, etc.
**UI-ändring:**
- Sidebar: kollapsibla kategorier istället för platt lista
- Onboarding: välja kategori → expandera undertaggar
- Feed-matchning: välja en kategori matchar alla dess undertaggar
**Insats:** M-L (schema-migration, seed-omskrivning, 3-4 UI-komponenter)

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

## Observability / Operations

### Backup-strategi för PostgreSQL
**Vad:** Ingen backup konfigurerad.
**Insats:** S (pg_dump cron)

### Health check endpoint
**Vad:** `/api/health` som kollar DB-anslutning.
**Insats:** XS

### Loggning
**Vad:** Ingen strukturerad loggning förutom console.error.
**Insats:** S (pino eller winston)
