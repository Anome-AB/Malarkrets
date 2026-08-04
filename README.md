# Vänliga Västerås

Community-plattform för aktiviteter i Västerås. Användare skapar, hittar och deltar
i lokala aktiviteter - vandring, fika, sport, kultur, kodning. Byggd som ett
intraprenörsprojekt.

## Stack

- **Next.js 16** (App Router, standalone output)
- **PostgreSQL 16** + Drizzle ORM
- **NextAuth v5** (Credentials-provider, bcrypt)
- **Tailwind CSS** + Satoshi/Instrument Sans
- **Vitest** för enhetstester
- **Docker** + GitHub Actions för release

## Kom igång (utveckling)

```bash
bun install
cp .env.example .env.local      # fyll i lokala värden
bun run db:migrate              # kör Drizzle-migrationer
bun run db:seed                 # fyll databasen med testdata
bun run dev                     # startar på http://localhost:3000
```

### Testkonton

Alla seedade konton har lösenordet `testlosen123`.

| E-post | Namn | Roll |
|--------|------|------|
| `anna@example.com` | Anna Karlsson | Användare |
| `erik@example.com` | Erik Persson | Användare |
| `sara@example.com` | Sara Lindqvist | Användare |
| `omar@example.com` | Omar Hassan | Användare |
| `lisa@example.com` | Lisa Johansson | Användare |
| `testanv1@vanligavasteras.se` | Test Användare 1 | Användare |
| `testadmin1@vanligavasteras.se` | Test Admin | **Admin** |

## Tester

```bash
bun run test              # engångskörning, samma som CI kör
bun run test:watch        # watch-mode under utveckling
bun run test:integration  # integrationstester (vitest.config.integration.ts)
```

CI kör `bun run lint`, `bunx tsc --noEmit`, `node scripts/check-migration-journal.mjs`
och båda testsviterna. Vill du se exakt vad som gäller: [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Release-pipeline

Push till `master` → GitHub Actions bygger en Docker-image och pushar till
`ghcr.io/anome-ab/malarkrets:latest` (samt `:sha-<hash>`).

Workflow: [`.github/workflows/release.yml`](.github/workflows/release.yml)

### Deploya lokalt från ghcr.io

Kräver Docker Desktop och `docker login ghcr.io` med en GitHub PAT som har
`read:packages`.

```bash
cp .env.prod.example .env       # fyll i värden (AUTH_SECRET, lösenord)
bash scripts/deploy-local.sh    # pullar image + startar hela stacken
```

Scriptet:
1. Pullar senaste imagen från ghcr.io.
2. Startar PostgreSQL och väntar på `pg_isready`.
3. Verifierar DB-anslutningen.
4. Startar app.
5. Pollar `/api/health` tills appen svarar.

Appen körs på `http://localhost:3000`.

### Köra migrationer och seed mot prod-databasen

Prod-containerns postgres exponerar inte port 5432 till host. Exponera den
temporärt i `docker-compose.yml` (`127.0.0.1:5433:5432`), kör migrationer/seed,
och ta sedan bort exponeringen:

```bash
# migrationer (från psql i containern)
for f in src/db/migrations/0*.sql; do
  docker compose exec -T postgres \
    psql -U malarkrets -d malarkrets < "$f"
done

# seed (från host - kräver temporär portmappning)
DATABASE_URL="postgresql://malarkrets:malarkrets_prod@localhost:5433/malarkrets" \
  bun run src/db/seed.ts
```

> **Obs:** I utvecklingsfasen får data wipeas fritt. Innan prod-lansering måste
> en riktig migrationsstrategi på plats - se `TODOS.md`.

## Projektstruktur

```
src/
  actions/      # Server actions (auth, aktiviteter, kommentarer, admin, tips)
  app/          # Next.js App Router: sidor, API-routes, layouts
  components/   # Delade UI-komponenter (Card, ConfirmDialog, …)
  contexts/     # React-contexts (unsaved-changes)
  db/           # Drizzle-schema, migrationer, seed
  hooks/        # Egna hooks (useAutoSave)
  lib/          # auth, db-klient, validering, hjälpare
  test/         # testuppsättning, mock-db, integrationstester
  instrumentation.ts   # OpenTelemetry-init vid serverstart
  proxy.ts             # auth-gate på requests (motsvarar middleware.ts i äldre Next)
scripts/        # deploy, provisionering, underhåll (RedFox)
.github/
  workflows/    # ci.yml, release.yml
Caddyfile              # reverse proxy, TLS och säkerhetsheaders inkl. CSP (RedFox)
Dockerfile             # multi-stage build (node:22-alpine)
docker-compose.yml     # app + postgres + caddy
docs/                  # deploy-, migrations- och observability-docs (RedFox)
```

## Designsystem

Alla UI-beslut följer [`DESIGN.md`](DESIGN.md). Kortversion:

- Använd `<Card>` (`@/components/ui/card`) för alla content-containrar.
- Formulärsidor: `max-w-3xl` med `<Card>`-sektioner.
- Detaljsidor: responsiva grid-layouts som fyller ytan.
- Spacing följer 4px-grid (aldrig 12px).
- Typografi: Satoshi (rubriker), Instrument Sans (brödtext).
- Accentfärg `#c4956a` (koppar), används sparsamt.

## Next.js-anvisningar

Detta projekt använder en Next.js-version med brytande ändringar mot äldre docs -
läs alltid `node_modules/next/dist/docs/` innan du skriver kod. Se `AGENTS.md`.

## Team-struktur

Repot underhålls av två team. Ansvarsområden och gränsytor: [`TEAMS.md`](TEAMS.md).
RedFox intern release-spelbok: [`RELEASE.md`](RELEASE.md).

## All dokumentation

| Fil | Innehåll | Ägare |
|-----|----------|-------|
| [`DESIGN.md`](DESIGN.md) | Designsystem: typografi, färg, spacing, komponentregler | GreenLion |
| [`AGENTS.md`](AGENTS.md) | Instruktioner till AI-agenter som jobbar i repot | Gemensam |
| [`CLAUDE.md`](CLAUDE.md) | Projektinstruktioner, skill-routing, health stack | Gemensam |
| [`TEAMS.md`](TEAMS.md) | Teamansvar, filägarskap, gränsytor som kräver samordning | Gemensam |
| [`TODOS.md`](TODOS.md) | Aktuella prioriteringar och backlog | Gemensam |
| [`RELEASE.md`](RELEASE.md) | Release- och deployprocess | RedFox |
| [`docs/DEPLOY_PLAYBOOK.md`](docs/DEPLOY_PLAYBOOK.md) | Tre färdiga deploy-sekvenser att klistra in | RedFox |
| [`docs/vps-setup.md`](docs/vps-setup.md) | Provisionering från blank Ubuntu 24.04-VPS | RedFox |
| [`docs/DATA_MIGRATIONS.md`](docs/DATA_MIGRATIONS.md) | När du ska använda migration respektive seed | RedFox |
| [`docs/dash0.md`](docs/dash0.md) | Observability: telemetri till Dash0 | RedFox |
| [`docs/*.zone`](docs) | DNS-zonfiler, manuellt exporterade snapshots | RedFox |

> **Obs om `docs/*.zone` och `.env.*.example`:** de är snapshots och mallar, inte
> live-tillstånd. Riktiga `.env.prod` committas aldrig, och zonfilerna uppdateras
> bara när någon exporterar om dem från Loopia. Verifiera alltid mot verkligheten
> (`Resolve-DnsName`, `curl -I`) innan du drar slutsatser om vad prod kör.
