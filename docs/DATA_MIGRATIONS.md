# Data migrations — when to use what

Två spår för att få data in i databasen. Var disciplinerad: blandar du dem
hamnar prod och dev i otakt.

## Regel 1: om appen förutsätter att det finns i prod → migration

All data som kodbasen kräver ska existera i prod går genom en migrationsfil
i `src/db/migrations/`. Gäller:

- Intressetaggar
- Courage-meddelanden
- Default-roller, default-inställningar, default-feature-flags
- Eventuella bootstrap-admins
- Lookup-tabeller

Varför migration: en entitet (drizzle-migrator) äger alla prod-ändringar,
hashar innehållet, och garanterar körning exakt en gång per miljö. Samma
mekanism som för schemaändringar.

### Rutin vid data-ändring

1. Skapa `src/db/migrations/NNNN_<beskrivning>.sql` (nästa lediga NNNN).
2. Skriv ren SQL. Exempel:

   ```sql
   -- Adding a new tag is idempotent via ON CONFLICT.
   INSERT INTO "interest_tags" ("name", "slug") VALUES
     ('Yoga på stranden', 'yoga-pa-stranden')
   ON CONFLICT (slug) DO NOTHING;
   ```

   Eller för rename (FK följer med via ID):

   ```sql
   UPDATE "interest_tags" SET name='Strand-yoga', slug='strand-yoga'
   WHERE slug='yoga-pa-stranden';
   ```

   Eller ta bort (cascade på user_interests och activity_tags):

   ```sql
   DELETE FROM "interest_tags" WHERE slug='obsolete-tag';
   ```

3. Lägg till entry i `src/db/migrations/meta/_journal.json` med nästa `idx`,
   nuvarande `Date.now()` i ms, och `tag` som matchar filnamnet. RedFox
   tillhandahåller en CLI (`bun run db:data-migration --name X`) som gör
   detta åt dig. Om du skriver journalen för hand: `when` MÅSTE vara större
   än senaste entry:s `when` (CI-check:en i `scripts/check-migration-journal.mjs`
   failar annars).
4. Kopiera senaste `NNNN_snapshot.json` till nästa nummer så drizzle-kit har
   en kontinuerlig historik (data-migrationer ändrar inget schema men
   drizzle-kit vill ha filen på plats).
5. Kör lokalt: `bun run db:migrate`. Verifiera att migrationen gör det den ska.

### Vad du INTE ska göra

- Redigera `seed.ts` för att lägga till taggar / courage / default-data.
  Det kommer funka lokalt men ALDRIG i prod, för seed körs aldrig i prod.
- Direkt köra `UPDATE`/`INSERT` mot prod-DB:n. Då har inte tracking-tabellen
  spår av ändringen och nästa utvecklare som gör samma förändring i koden
  kommer krocka.
- Redigera en existerande migration som redan körts på någon miljö. Varje
  ändring = ny migrationsfil.

## Regel 2: om data bara gör dev-livet lättare → seed

`src/db/seed.ts` kör bara i development. Den refuserar `NODE_ENV=production`
och hoppar över om demo-usern `anna@example.com` redan finns.

Den innehåller:

- Demo-users (Anna, Erik, Sara, Omar, Lisa)
- Testanvändare (testanv1–3, testadmin1)
- Demo-aktiviteter med korsprotokoll-relationer
- Demo-deltagare och demo-kommentarer

Den förutsätter att migrationerna har körts och att taggarna redan finns i
databasen (den gör `SELECT` på `interest_tags` för att slå upp ID:n).

### Rutin lokalt

```bash
bun run db:migrate   # kör alla migrationer, inklusive baseline-data
bun run db:seed      # lägg på demo-fixtures
```

Vill du börja om: nuka DB + kör båda.

## Beslutsträd

- Lägger du till en **tagg, courage-mening, eller annan data kod refererar**
  → **migration**.
- Lägger du till en **test-user eller test-aktivitet för att se hur det ser ut
  i UI:t** → **seed**.
- Ändrar du en **typisk konfiguration som är samma i alla envs** → **migration**.
- Skapar du en **demo-miljö med mock-data** → **seed**.

Om du är osäker: fråga dig själv "behöver prod den här datan för att appen
ska fungera?". Ja → migration. Nej → seed.
