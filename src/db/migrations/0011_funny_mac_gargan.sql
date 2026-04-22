-- Split user name into first_name + last_name alongside the existing display_name.
-- Nullable for legacy rows. The profile form auto-suggests display_name as
-- "<firstName> <lastName[0]>" when both are filled (e.g. "Fredrik I"), but the
-- user can override display_name manually.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;