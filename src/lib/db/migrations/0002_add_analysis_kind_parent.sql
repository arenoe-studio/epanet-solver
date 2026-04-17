ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'optimize';
ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "parent_analysis_id" integer;

