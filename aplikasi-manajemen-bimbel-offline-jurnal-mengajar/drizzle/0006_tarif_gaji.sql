CREATE TABLE "salary_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarif_per_jam" numeric(12, 2) NOT NULL,
	"skema" varchar(40) DEFAULT 'per jam' NOT NULL,
	"berlaku_sejak" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "salary_settings_berlaku_sejak_idx" ON "salary_settings" USING btree ("berlaku_sejak");