-- Konverterar de timestamp-utan-tidszon-kolumner som vi jämför för
-- olast-räkningen till timestamptz. Tidigare blandades två sätt att
-- skriva: postgres now() default (session-lokal tid = Europe/Berlin)
-- och Drizzles new Date() (UTC). Samma kolumntyp men inkonsekvent
-- referenstidssystem → comparisons gick åt fel håll.
--
-- timestamptz lagrar absolut instans med tz-info, så både JS Date och
-- postgres now() blir konsekventa framöver. AT TIME ZONE 'UTC' tolkar
-- existerande värden som UTC. Det stämmer för Drizzles inserts;
-- värden från postgres default now() (lokal tid) får +2h-felaktig
-- absolut tid, vilket vi accepterar för testdata.

ALTER TABLE "feedback_tips"
  ALTER COLUMN "last_activity_at" TYPE timestamptz
    USING last_activity_at AT TIME ZONE 'UTC',
  ALTER COLUMN "last_reporter_activity_at" TYPE timestamptz
    USING last_reporter_activity_at AT TIME ZONE 'UTC',
  ALTER COLUMN "last_admin_activity_at" TYPE timestamptz
    USING last_admin_activity_at AT TIME ZONE 'UTC';

ALTER TABLE "feedback_tip_views"
  ALTER COLUMN "last_viewed_at" TYPE timestamptz
    USING last_viewed_at AT TIME ZONE 'UTC';

-- Återställ existerande view-rader så testdata inte hamnar som
-- falskt oläst efter konverteringen. Sätt last_viewed_at till
-- senaste aktivitet på tipset + 1 sekund, dvs "admin/rapportör har
-- sett allt fram till nu".
UPDATE "feedback_tip_views" ftv
SET "last_viewed_at" = ft.activity + INTERVAL '1 second'
FROM (
  SELECT
    id,
    GREATEST(
      last_reporter_activity_at,
      COALESCE(last_admin_activity_at, last_reporter_activity_at)
    ) AS activity
  FROM "feedback_tips"
) ft
WHERE ftv.tip_id = ft.id;
