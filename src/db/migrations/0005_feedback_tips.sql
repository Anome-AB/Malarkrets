-- Tips från testare: buggrapporter och idéer under PRE-GO-LIVE.
-- "Tips" är varumärket användaren ser; tabellen följer samma språk så
-- query:n och UI:t pratar samma. Befintliga reports-tabellen är för
-- content-moderation (rapportera olämpligt innehåll), inte produkt-feedback.
--
-- Browser-metadata (page_url, user_agent, viewport, console_log) fångas
-- klient-sidan när tipset skickas. Screenshot lagras via befintliga
-- images-tabellen.

CREATE TYPE "feedback_kind" AS ENUM ('bug', 'idea');
CREATE TYPE "feedback_severity" AS ENUM ('blocker', 'high', 'medium', 'low');
CREATE TYPE "feedback_status" AS ENUM (
  'open',
  'triaged',
  'in_progress',
  'done',
  'wont_fix',
  'duplicate'
);

CREATE TABLE "feedback_tips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "kind" "feedback_kind" NOT NULL,
  "severity" "feedback_severity" NOT NULL DEFAULT 'medium',
  "status" "feedback_status" NOT NULL DEFAULT 'open',
  "description" text NOT NULL,
  "page_url" text,
  "user_agent" text,
  "viewport_width" integer,
  "viewport_height" integer,
  "console_log" text,
  "app_version" text,
  "screenshot_image_id" uuid REFERENCES "images"("id") ON DELETE SET NULL,
  "admin_notes" text,
  "resolved_at" timestamp,
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Admin-listning sorterar nyaste först per status
CREATE INDEX "feedback_tips_status_created_idx"
  ON "feedback_tips" ("status", "created_at" DESC);

-- "Mina tips"-vy för testaren
CREATE INDEX "feedback_tips_reporter_idx"
  ON "feedback_tips" ("reporter_id", "created_at" DESC);

-- Triage: blockers och high först
CREATE INDEX "feedback_tips_severity_status_idx"
  ON "feedback_tips" ("severity", "status");

-- Filter på typ i admin-vy
CREATE INDEX "feedback_tips_kind_status_idx"
  ON "feedback_tips" ("kind", "status");
