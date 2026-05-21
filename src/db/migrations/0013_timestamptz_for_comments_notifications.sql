-- Samma fix som 0012 men för aktivitetskommentarer och notifikationer.
-- Båda tabellerna visar "X min sedan" i UI:t via JS Date-jämförelse, så
-- timestamp-utan-tz blandat med Drizzle:s new Date() (UTC) och postgres
-- now() (Europe/Berlin) gör att tidsdelta blir negativ kort efter create
-- och vi felaktigt visar "just nu" / "nyss" i timmar.
--
-- timestamptz lagrar absolut instans, så både JS Date och postgres now()
-- blir konsekventa framöver. AT TIME ZONE 'UTC' tolkar existerande värden
-- som UTC - korrekt för Drizzle-inserts, +2h-felaktigt för defaultNow():er
-- från seed/manuella inserts. Vi accepterar driften för historiska rader.

ALTER TABLE "activity_comments"
  ALTER COLUMN "created_at" TYPE timestamptz
    USING created_at AT TIME ZONE 'UTC';

ALTER TABLE "notifications"
  ALTER COLUMN "created_at" TYPE timestamptz
    USING created_at AT TIME ZONE 'UTC';
