# Mälarkrets

Community-plattform för aktiviteter i Västerås. Användare skapar, hittar och deltar
i lokala aktiviteter — vandring, fika, sport, kultur, kodning. Byggd som ett
intraprenörsprojekt.

## Stack

- **Next.js 16** (App Router, standalone output)
- **PostgreSQL 16** + Drizzle ORM
- **NextAuth v5** (Credentials-provider, bcrypt)
- **MinIO** (S3-kompatibel objektlagring för bilder)
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
| `testanv1@malarkrets.se` | Test Användare 1 | Användare |
| `testadmin1@malarkrets.se` | Test Admin | **Admin** |

## Tester

```bash
bun run test            # Vitest i watch-mode
bun run test -- --run   # CI-läge
```

## Release-pipeline

Push till `master` → GitHub Actions bygger en Docker-image och pushar till
`ghcr.io/ohman74/malarkrets:latest` (samt `:sha-<hash>`).

Workflow: [`.github/workflows/release.yml`](.github/workflows/release.yml)

### Deploya lokalt från ghcr.io

Kräver Docker Desktop och `docker login ghcr.io` med en GitHub PAT som har
`read:packages`.

```bash
cp .env.prod.example .env.prod  # fyll i värden (AUTH_SECRET, lösenord)
bash scripts/deploy-local.sh    # pullar image + startar hela stacken
```

Scriptet:
1. Pullar senaste imagen från ghcr.io.
2. Startar PostgreSQL och väntar på `pg_isready`.
3. Verifierar DB-anslutningen.
4. Startar app + MinIO.
5. Pollar `/api/health` tills appen svarar.

Appen körs på `http://localhost:3000`, MinIO-konsolen på
`http://127.0.0.1:9001` (endast loopback).

### Köra migrationer och seed mot prod-databasen

Prod-containerns postgres exponerar inte port 5432 till host. Exponera den
temporärt i `docker-compose.prod.yml` (`127.0.0.1:5433:5432`), kör migrationer/seed,
och ta sedan bort exponeringen:

```bash
# migrationer (från psql i containern)
for f in src/db/migrations/0*.sql; do
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U malarkrets -d malarkrets < "$f"
done

# seed (från host — kräver temporär portmappning)
DATABASE_URL="postgresql://malarkrets:malarkrets_prod@localhost:5433/malarkrets" \
  bun run src/db/seed.ts
```

> **Obs:** I utvecklingsfasen får data wipeas fritt. Innan prod-lansering måste
> en riktig migrationsstrategi på plats — se `TODOS.md`.

## Projektstruktur

```
src/
  app/          # Next.js App Router: sidor, API-routes, layouts
  components/   # Delade UI-komponenter (Card, ConfirmDialog, …)
  db/           # Drizzle-schema, migrationer, seed
  lib/          # auth, db-klient, validering, hjälpare
scripts/        # deploy-local.sh
.github/
  workflows/    # release.yml
Dockerfile                  # multi-stage build (node:22-alpine)
docker-compose.prod.yml     # app + postgres + minio
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

Detta projekt använder en Next.js-version med brytande ändringar mot äldre docs —
läs alltid `node_modules/next/dist/docs/` innan du skriver kod. Se `AGENTS.md`.

## TODOS

Aktuella prioriteringar och backlog finns i [`TODOS.md`](TODOS.md).
