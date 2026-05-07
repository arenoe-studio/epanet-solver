ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "credited_at" timestamp;--> statement-breakpoint
UPDATE "transactions"
SET "credited_at" = coalesce("paid_at", "created_at", now())
WHERE "status" = 'paid' AND "credited_at" IS NULL;--> statement-breakpoint
