# Deploy-playbook

Tre scenarios, tre ready-to-paste-sekvenser. Mer finns i `RELEASE.md` om du
vill förstå WHY, den här filen är för att få det gjort snabbt.

## Innan du börjar — tumregler

- **Prod är malarkrets.se** (VPS `213.188.155.69`, SSH-user `deploy`).
- **Staging är din egen Docker Desktop** mot `malarkrets_test`-DB.
- **Dataförlust är acceptabel** under PRE-GO-LIVE. Efter go-live — detta dokument uppdateras.
- **Alla scenarios utgår från** att du har master-branschen pullad lokalt och ser OK CI på GitHub.

---

## Scenario 1: Vanlig deploy (95% av fallen)

Ingen schema-wipe behövs. `deploy-local.sh` pullar nya images, kör migrate (incremental add-migration), recreate:ar app.

### Staging
```bash
bash scripts/deploy-local.sh
```

### Prod
```bash
ssh deploy@malarkrets.se 'cd ~/malarkrets && bash scripts/deploy-local.sh'
```

### När det fungerar
- Script:et skriver `=== deploy klar ===` och visar `{"status":"ok"}` från health-endpointen.
- `docker compose logs migrate --tail 10` visar antingen `migrate: done` (inget nytt att applicera) eller INSERT/CREATE-rader följt av `migrate: done`.

### När det INTE fungerar
Vanligaste felen:
- **`cause: column "X" does not exist`** — schema-drift. Se Scenario 2 (data-breaking release).
- **`relation "X" already exists`** (NOTICE) → migrate: done, men data saknas — stale image. Kör `docker compose pull` explicit, sedan `up -d --force-recreate`.
- **Healthcheck failar efter 60s** — kolla `docker compose logs app --tail 50`.

---

## Scenario 2: Data-breaking release (t.ex. migration squash)

När release:n kräver att hela DB rensas. Känns igen på att PR-beskrivningen säger "data-breaking" eller innehåller `DROP SCHEMA`/squash-instruktioner.

### Förutsättningar
- Backup-säkerhet: scriptet gör automatiskt `pg_dumpall` till `~/backup-pre-wipe-<timestamp>.sql.gz` innan något raderas.
- Du har läst PR-beskrivningen och förstår att ALL data kommer bort.

### Staging
```bash
bash scripts/wipe-and-redeploy.sh
# skriv WIPE för att bekräfta
```

### Prod
```bash
ssh deploy@malarkrets.se
cd ~/malarkrets
bash scripts/wipe-and-redeploy.sh
# skriv WIPE för att bekräfta
```

### Vad scriptet gör (sammanfattning)
1. Backup till hemkatalog (endast om postgres kör just nu)
2. `docker compose down -v` — containrar + volymer raderas
3. `docker compose pull` + `--profile tools pull` — senaste images
4. Startar postgres, väntar på `pg_isready`
5. Om `DATABASE_URL` pekar på annat DB-namn än `malarkrets` (t.ex. `_test`), skapar scriptet den
6. Startar resten, migrate kör från scratch
7. Pollar `/api/health` och rapporterar

### Efter scenario 2 — seed demo-data (valfritt)

Baseline-migrationen (0001) fyller i reference-data (93 tags, 16 courage messages). Demo-users + demo-activities kräver seed-containern:

```bash
# Staging (NODE_ENV är inte satt → seed kör utan override)
docker compose run --rm seed

# Prod (seed.ts refuserar NODE_ENV=production — override om du vill köra)
NODE_ENV=development docker compose run --rm seed
```

---

## Scenario 3: Rollback

Senaste release har en bugg vi inte kan fixa framåt snabbt nog. Backa till förra taggen.

### Förutsättningar
- En `backup-pre-*.sql.gz` från före senaste deploy finns tillgänglig
- Du vet vilken image-SHA som var "bra" innan (oftast föregående merge till master)

### Steg 1 — Hitta förra image-SHA:n
```bash
# Lista senaste byggen
gh run list --limit 10 --workflow release.yml
# Klicka på den föregående OK-körningen, notera commit-SHA (första 7 tecknen)
```

### Steg 2 — Pinna APP_TAG + MIGRATE_TAG i `.env` på målmiljön

På VPS:
```bash
ssh deploy@malarkrets.se
cd ~/malarkrets
# Editera .env:
#   APP_TAG=sha-<sha7>
#   MIGRATE_TAG=migrate-sha-<sha7>
nano .env
```

På staging: samma men lokalt.

### Steg 3 — Om schema behöver rullas tillbaka (sällan)
Om den "trasiga" deployen körde en migration som raderade kolumner eller droppade tabeller, behöver DB:n restaureras från backup:
```bash
# Stoppa
docker compose stop app migrate

# Restore backup (på VPS)
gunzip -c ~/backup-pre-*.sql.gz | docker compose exec -T postgres psql -U malarkrets -d postgres

# Starta med pinnad image
docker compose up -d --force-recreate app migrate
```

Om den trasiga deployen BARA var kod (ingen migration), räcker det med steg 2 + `docker compose up -d --force-recreate app`.

### Steg 4 — Verifiera
```bash
curl -I https://malarkrets.se/api/health
docker compose logs app --tail 30
```

### Steg 5 — Följa upp
- Fixa root cause framåt (bug-fix PR)
- När den är testad och merg:ad, ta bort `APP_TAG`/`MIGRATE_TAG` från `.env` så deployer följer `:latest` igen

---

## Snabb-referens — kommandon du alltid behöver

```bash
# Kolla stacken
docker compose ps

# Tail app
docker compose logs app --tail 50 -f

# Tail migrate (one-shot — visar bara senaste körning)
docker compose logs migrate --tail 30

# Verifiera schema-state
docker compose exec -T postgres psql -U malarkrets -d malarkrets \
  -c "SELECT COUNT(*) FROM drizzle.__drizzle_migrations;"

# Testa health utifrån
curl -I https://malarkrets.se/api/health

# Manuell backup (snabb)
docker compose exec -T postgres pg_dumpall -U malarkrets | gzip > backup.sql.gz
```

---

## När i tvivel

Om deploy:en beter sig konstigt och du inte vet om det är schema, cache eller nätverk:

1. **Först**: `docker compose logs migrate --tail 30`. Om den säger något annat än `migrate: done` utan NOTICES → schema-problem, gå till Scenario 2.
2. **Sen**: `docker images | grep malarkrets` — är images från idag? Om inte → `docker compose pull` + `--profile tools pull`.
3. **Om fortfarande fel**: backup säkrad (`pg_dumpall`), kör Scenario 2. Wipe fixar nästan allt under PRE-GO-LIVE.
