ALTER TYPE "public"."notification_type" ADD VALUE 'activity_cancelled';--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "cancelled_reason" text;