-- Differentiera arrangör-borttagning från användarens egen borttagning.
-- Tidigare ramlade båda fallen ner i samma "deletedAt utan deletedByAdminId"-
-- bucket och fick samma tombstone-text. Nu kan UI:t säga "av arrangör" när
-- en host tagit bort en deltagar-kommentar.
--
-- Admin tar precedens om arrangören även är admin: deletedByAdminId och
-- deletedByCreatorId är mutuellt exklusiva - bara en av dem sätts.

ALTER TABLE "activity_comments"
  ADD COLUMN "deleted_by_creator_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
