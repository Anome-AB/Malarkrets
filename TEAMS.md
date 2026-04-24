# Teams & ansvar

Detta repo hanteras av två Claude-baserade team. Denna fil är det **gemensamma
gränssnittet** — båda teamens Claude läser den. Interna arbetssätt ligger i
respektive teams egna filer (`RELEASE.md`, ev. `DEVELOPMENT.md`).

## Team GreenLion — Applikation

**Ägs av:** Fredriks team.
**Ansvarar för:** Funktionalitet, domänlogik, UI, databasschema.

**Äger följande i repot:**
- `src/` — all applikationskod (App Router, komponenter, lib, auth)
- `src/db/` — Drizzle-schema, migrationer, seed
- `public/`
- `package.json`, `bun.lock`, `tsconfig.json`, `next.config.ts`, `drizzle.config.ts`
- `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`
- `DESIGN.md`

**Commit-prefix:** `feat(app):`, `fix(app):`, `refactor(app):`, `test(app):`,
`docs(app):`, `feat(db):`, `fix(db):`

**Releaser & versioner:** Ägs av RedFox. GreenLion bumpar inte `package.json`,
sätter inga git-tags, skriver inget i `public/release-notes.json` och skapar
inga GitHub Releases. Merga till `master` — det räcker. Flagga bara i
PR-beskrivningen om ändringen är breaking (schema/API) eller om en
användarsynlig fix förtjänar en notis till testarna, så plockar RedFox upp
det vid nästa release-tillfälle.

## Team RedFox — Release & Deploy

**Ägs av:** Hakan.
**Ansvarar för:** Bygg-pipeline, deploy, infrastruktur, secrets, observability.

**Äger följande i repot:**
- `.github/workflows/` — GitHub Actions
- `Dockerfile`, `.dockerignore`
- `docker-compose.yml`
- `scripts/` — deploy- och ops-scripts
- `.env.prod.example` (mallen; själva `.env.prod` committas aldrig)
- `RELEASE.md`

**Commit-prefix:** `ci:`, `chore(deploy):`, `chore(infra):`, `chore(dev):`,
`docs(release):`

## Gemensamt ägt

- `README.md`, `AGENTS.md`, `CLAUDE.md`, `TEAMS.md`, `TODOS.md` — båda team får
  redigera. Större strukturändringar: synka i PR.

## Gränsytor som kräver samordning

Följande ändringar går inte att göra isolerat — respektive Claude ska flagga
när den rör dessa:

| Utlösare | GreenLion gör | RedFox gör |
|---|---|---|
| Ny env-variabel behövs i runtime | Lägger till i `.env.example` + kod | Wire:ar i `docker-compose.yml`, ev. `Dockerfile` (build-arg), `.env.prod.example`, GitHub Secret |
| Ny extern tjänst/port | Dokumenterar i PR | Lägger till i compose, nätverksregler, health-check |
| Ny DB-migration | Skriver migration-SQL | Säkerställer att den körs i deploy-flödet (se `RELEASE.md`) |
| Breaking schema-ändring | Flaggar i PR-beskrivning | Planerar migrationsordning + ev. data-backfill |
| Beroende på GitHub Secret | Beskriver i PR | Lägger till secret, verifierar pipeline |

## PR-regler

- Varje PR anger tydligt vilket team som äger ändringen.
- Om en PR korsar teamgräns: nämn det andra teamet i beskrivningen ("Kräver
  RedFox-wiring av ny env-variabel `FOO_API_KEY`").
- `CODEOWNERS` (om/när infört) triggar rätt review automatiskt.

## För Claude — beslutsregel

Innan du börjar ändra:
1. Vilket team äger filen du är på väg att ändra? Om det är motsatt teams
   område — stanna och flagga till användaren.
2. Korsar ändringen en gränsyta (tabellen ovan)? Nämn det explicit i ditt
   svar så användaren kan koordinera med andra teamet.
3. Rör ändringen deploy/infra? Läs `RELEASE.md`. Rör den app/domän? Läs
   relevant avsnitt i `node_modules/next/dist/docs/` (se `AGENTS.md`).
