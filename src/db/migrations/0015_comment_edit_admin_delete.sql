-- Två nya kolumner på activity_comments för redigering + admin-moderation:
--
-- edited_at: sätts när författaren själv redigerar sin kommentar. UI:t
-- visar "(redigerad)" om värdet är non-null.
--
-- deleted_by_admin_id: sätts när en admin tar bort någon annans kommentar.
-- Raden lämnas kvar som tombstone så användaren ser att modereringen skett.
-- Författaren som tar bort sin egen kommentar gör hard-delete istället.

ALTER TABLE "activity_comments"
  ADD COLUMN "edited_at" timestamptz,
  ADD COLUMN "deleted_by_admin_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
