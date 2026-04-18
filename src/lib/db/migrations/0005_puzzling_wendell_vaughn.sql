CREATE TABLE "analysis_snapshots" (
	"analysis_id" integer PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "analysis_snapshots" ADD CONSTRAINT "analysis_snapshots_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_snapshots_expires_at_idx" ON "analysis_snapshots" USING btree ("expires_at");
