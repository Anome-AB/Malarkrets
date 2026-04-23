CREATE TYPE "public"."user_token_type" AS ENUM('verify_email', 'reset_password');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" "user_token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"email_hash" text NOT NULL,
	"ip" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_tokens_hash_idx" ON "user_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tokens_ratelimit_email_idx" ON "user_tokens" USING btree ("email_hash","type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tokens_ratelimit_ip_idx" ON "user_tokens" USING btree ("ip","type","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_tokens_cleanup_idx" ON "user_tokens" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp;--> statement-breakpoint
-- Drop plaintext email_verification_token column. Outstanding verification
-- emails at time of migration are invalidated; PRE-GO-LIVE = 0 real users,
-- so backfilling (which would require re-hashing a secret we already leaked
-- in clear) is not worth the complexity. Users can re-request verification.
ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_token";
