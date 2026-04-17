ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "snap_token" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "snap_token_expires_at" timestamp;--> statement-breakpoint
