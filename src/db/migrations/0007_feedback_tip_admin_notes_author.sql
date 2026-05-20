-- Spårar vilken admin som senast skrev admin_notes-fältet på ett feedback_tip
-- så testaren kan se "Sammanfattning från Lisa" i stället för det opersonliga
-- "Sammanfattning från oss".
--
-- ON DELETE SET NULL: om admin-kontot tas bort behåller vi notes-innehållet
-- (det är värdefullt) men tappar identifieringen.

ALTER TABLE "feedback_tips"
  ADD COLUMN "admin_notes_author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
