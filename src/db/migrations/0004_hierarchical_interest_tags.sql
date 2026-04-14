-- Add hierarchical columns to interest_tags
ALTER TABLE "interest_tags" ADD COLUMN "parent_id" integer;
ALTER TABLE "interest_tags" ADD COLUMN "depth" integer NOT NULL DEFAULT 0;
ALTER TABLE "interest_tags" ADD COLUMN "sort_order" integer DEFAULT 0;

-- Add self-referencing foreign key with cascade delete
ALTER TABLE "interest_tags" ADD CONSTRAINT "interest_tags_parent_id_interest_tags_id_fk" FOREIGN KEY ("parent_id") REFERENCES "interest_tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- Drop the old category column
ALTER TABLE "interest_tags" DROP COLUMN IF EXISTS "category";
