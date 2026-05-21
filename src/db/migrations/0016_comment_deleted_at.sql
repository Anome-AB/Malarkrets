-- Lägger till deleted_at för att soft-delete:a kommentarer. Tidigare hade vi
-- bara deleted_by_admin_id som markör, men användarens egen borttagning ska
-- också lämna en tombstone - vi behöver en gemensam "är denna borttagen?"-
-- flagga som inte är knuten till admin-rollen.
--
-- Befintliga rader med deleted_by_admin_id != NULL backfillas med NOW() så
-- de inte plötsligt blir "ej borttagna" igen.

ALTER TABLE "activity_comments"
  ADD COLUMN "deleted_at" timestamptz;

UPDATE "activity_comments"
SET "deleted_at" = NOW()
WHERE "deleted_by_admin_id" IS NOT NULL;
