CREATE TYPE "public"."admin_action_type" AS ENUM('activity_edited', 'activity_cancelled', 'activity_deleted', 'activity_restored', 'user_banned', 'user_unbanned');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'activity_edited_by_admin';--> statement-breakpoint
CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action_type" "admin_action_type" NOT NULL,
	"target_activity_id" uuid,
	"target_user_id" uuid,
	"source_report_id" uuid,
	"reason" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "color_theme" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "deleted_reason" text;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_activity_id_activities_id_fk" FOREIGN KEY ("target_activity_id") REFERENCES "public"."activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_source_report_id_reports_id_fk" FOREIGN KEY ("source_report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_actions_admin_idx" ON "admin_actions" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_actions_activity_idx" ON "admin_actions" USING btree ("target_activity_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_actions_user_idx" ON "admin_actions" USING btree ("target_user_id","created_at");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_deleted_at_idx" ON "activities" USING btree ("deleted_at");