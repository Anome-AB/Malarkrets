CREATE TABLE IF NOT EXISTS "courage_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"audience" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
-- NOTE: "images" table already created in 0007_images_in_database.sql,
-- but schema.ts added it later — re-declare as IF NOT EXISTS so this
-- migration is idempotent for environments that have it and for fresh DBs.
CREATE TABLE IF NOT EXISTS "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data" "bytea" NOT NULL,
	"content_type" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
