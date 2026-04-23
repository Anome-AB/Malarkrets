-- Remove columns and types that were defined but never read.
-- activities.municipality_id: only ever defaulted to "vasteras", premature localisation.
-- users.location: legacy free-text field, set via profile form but never displayed anywhere.
-- users.municipality_id: same story as activities.
-- experience_level type: pgEnum defined but not attached to any column. activities.what_to_expect
--   stores experienceLevel as a jsonb key, validated by zod; the pgEnum was unused duplicate.
ALTER TABLE "activities" DROP COLUMN IF EXISTS "municipality_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "location";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "municipality_id";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."experience_level";