-- Stores the dominant saturated colour extracted from the uploaded activity
-- image. Used as a tinted overlay on the date-block of the activity card
-- (see DESIGN.md › Activity Card). Nullable: null for legacy rows and for
-- activities with a colorTheme instead of an image. Backfill is optional;
-- the card falls back to a neutral stone fill when null.
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "image_accent_color" text;