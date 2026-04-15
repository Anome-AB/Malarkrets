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
startar `docker-compose.prod.yml`.

## Rutiner

### Lägga till ny runtime env-variabel (kommer från GreenLion)

1. Bekräfta i PR att GreenLion har lagt till variabeln i `.env.example` + kod.
2. Avgör om den behövs vid **build** (t.ex. `NEXT_PUBLIC_*`) eller **runtime**.
3. **Build-tid:** lägg till i `Dockerfile` som `ARG` + `ENV`, och i
   `release.yml` som `--build-arg`. Kräver GitHub Secret.
4. **Runtime:** lägg till i `docker-compose.prod.yml` under `environment:`
   och i `.env.prod.example`.
5. Om värdet är hemligt → GitHub Secret. Annars → committad default i
   `.env.prod.example`.
6. Verifiera genom att trigga en release och läsa bygg-loggen.

### Lägga till GitHub Secret

- CLI: `gh secret set NAMN --repo ohman74/Malarkrets`
- Webb: Settings → Secrets and variables → Actions.
- Dokumentera i `.env.prod.example` med kommentar `# set via GitHub Secret`.

### Release-tagging (planerat, se TODOS)

- `git tag v1.2.3 && git push --tags` → pipelinen taggar imagen
  `ghcr.io/ohman74/malarkrets:v1.2.3`.
- Rollback: `docker compose pull` med specifik tag i `.env.prod`.

### Databas-migrationer

**Status:** Manuellt idag. Automatiseringsbeslut pågår — se `TODOS.md`
("Automatiska DB-migrationer vid deploy"). Kräver avstämning med GreenLion.

**Idag (dev/staging):**
```bash
for f in src/db/migrations/0*.sql; do
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U malarkrets -d malarkrets < "$f"
done
```

Prod-postgres exponerar **inte** 5432 mot host. Temporär portmappning
`127.0.0.1:5433:5432` kan läggas till i compose-filen för seed/verktyg,
och ska tas bort direkt efter.

### Deploya lokalt från ghcr.io

Se `README.md` för user-facing steg. Internt:
`scripts/deploy-local.sh` gör pull → postgres-wait → db-probe → app+minio →
health poll. Läs scriptet innan ändringar.

## Säkerhet

- `.env.prod` committas **aldrig**. `.gitignore` skyddar det.
- MinIO-konsolen binds till `127.0.0.1:9001` — inte exponerad.
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
- [ ] Logga release i `TODOS.md` eller release-notes

## Gränsyta mot GreenLion

Läs `TEAMS.md` för full tabell. Vanligaste flaggningsfall:
- GreenLion introducerar env-variabel → be dem tagga PR med "kräver RedFox".
- GreenLion lägger migration → be dem inkludera en kort beskrivning av
  breaking-potential i PR-texten.
