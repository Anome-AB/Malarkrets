-- Kommentarstråd på feedback_tips. Både rapportören och admins kan
-- skriva, alla kommentarer är synliga för båda parter (inga internal/
-- private-noter). admin_notes-fältet på feedback_tips finns kvar som
-- admins korta interna anteckning.

CREATE TABLE "feedback_tip_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tip_id" uuid NOT NULL REFERENCES "feedback_tips"("id") ON DELETE CASCADE,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "body" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "feedback_tip_comments_tip_created_idx"
  ON "feedback_tip_comments" ("tip_id", "created_at");

-- last_activity_at speglar antingen tipsets created_at eller senaste
-- kommentaren, så listor sorteras på "nyast aktivitet" utan att behöva
-- joina och aggregera. Triggern uppdaterar det automatiskt.
ALTER TABLE "feedback_tips"
  ADD COLUMN "last_activity_at" timestamp NOT NULL DEFAULT now();

UPDATE "feedback_tips" SET "last_activity_at" = "created_at";

CREATE INDEX "feedback_tips_last_activity_idx"
  ON "feedback_tips" ("last_activity_at" DESC);

-- Bumpa last_activity_at när en kommentar läggs till
CREATE OR REPLACE FUNCTION feedback_tips_bump_activity() RETURNS trigger AS $$
BEGIN
  UPDATE "feedback_tips"
    SET "last_activity_at" = NEW.created_at
    WHERE "id" = NEW.tip_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_tip_comments_bump_activity
  AFTER INSERT ON "feedback_tip_comments"
  FOR EACH ROW EXECUTE FUNCTION feedback_tips_bump_activity();
