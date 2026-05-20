-- Konversationstråden från 0006 ersätter admin_notes-fältet. För att
-- inte tappa redan skrivna noter migrerar vi varje rad med innehåll
-- till första kommentaren i tråden innan kolumnerna droppas.
--
-- För rader med admin_notes satt men admin_notes_author_id NULL (tips
-- som triage:ats innan 0007 lades till) skapas en kommentar utan
-- tydlig avsändare, vi använder den admin som senast resolved tipset
-- om sådan finns, annars rapportören själv som dummy-författare.

INSERT INTO "feedback_tip_comments" ("tip_id", "author_id", "body", "created_at")
SELECT
  ft.id,
  COALESCE(ft.admin_notes_author_id, ft.resolved_by, ft.reporter_id),
  ft.admin_notes,
  COALESCE(ft.resolved_at, ft.updated_at, ft.created_at)
FROM "feedback_tips" ft
WHERE ft.admin_notes IS NOT NULL AND length(trim(ft.admin_notes)) > 0;

ALTER TABLE "feedback_tips" DROP COLUMN "admin_notes";
ALTER TABLE "feedback_tips" DROP COLUMN "admin_notes_author_id";
