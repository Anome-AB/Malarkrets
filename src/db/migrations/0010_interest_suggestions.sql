-- Lägger till möjligheten att föreslå nya intressen via "Tipsa oss".
-- En tip av kind='interest' har en eller flera rader i
-- feedback_tip_interest_suggestions, en per föreslaget intresse.
-- Admin kan godkänna varje förslag separat, vilket skapar en
-- interest_tags-rad och pekar ut den via approved_as_tag_id. Avslag
-- och duplikat-markering finns också, med valfri orsak.

ALTER TYPE "feedback_kind" ADD VALUE IF NOT EXISTS 'interest';

CREATE TYPE "interest_suggestion_status" AS ENUM (
  'pending',
  'approved',
  'rejected',
  'duplicate'
);

CREATE TABLE "feedback_tip_interest_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tip_id" uuid NOT NULL REFERENCES "feedback_tips"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "status" "interest_suggestion_status" NOT NULL DEFAULT 'pending',
  "approved_as_tag_id" integer REFERENCES "interest_tags"("id") ON DELETE SET NULL,
  "decided_at" timestamp,
  "decided_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "decision_reason" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "feedback_tip_interest_suggestions_tip_idx"
  ON "feedback_tip_interest_suggestions" ("tip_id", "created_at");

CREATE INDEX "feedback_tip_interest_suggestions_status_idx"
  ON "feedback_tip_interest_suggestions" ("status", "created_at");
