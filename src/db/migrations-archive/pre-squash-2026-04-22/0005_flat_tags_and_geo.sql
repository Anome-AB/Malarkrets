-- Drop hierarchical interest tags columns (rolled back to flat tags)
ALTER TABLE "interest_tags" DROP CONSTRAINT IF EXISTS "interest_tags_parent_id_interest_tags_id_fk";
ALTER TABLE "interest_tags" DROP COLUMN IF EXISTS "parent_id";
ALTER TABLE "interest_tags" DROP COLUMN IF EXISTS "depth";
ALTER TABLE "interest_tags" DROP COLUMN IF EXISTS "sort_order";

-- Add geo coordinates to activities (for Google Maps integration)
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "latitude" double precision;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "longitude" double precision;
