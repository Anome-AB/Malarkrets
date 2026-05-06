-- Add published_at to activities. Drafts have published_at = NULL och syns
-- bara för creator + admin. Publicerade aktiviteter har published_at satt
-- och dyker upp i den publika feeden.
--
-- Befintliga rader vid migration är redan publika och ska därför markeras
-- som publicerade. Vi använder created_at som published_at-timestamp så
-- historiken bevaras korrekt.

ALTER TABLE "activities" ADD COLUMN "published_at" timestamp;

UPDATE "activities" SET "published_at" = "created_at" WHERE "published_at" IS NULL;

CREATE INDEX IF NOT EXISTS "activities_published_at_idx" ON "activities" ("published_at");
