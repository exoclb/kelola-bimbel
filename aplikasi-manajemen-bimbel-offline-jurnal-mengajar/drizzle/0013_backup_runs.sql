CREATE TABLE "backup_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mulai" timestamp with time zone DEFAULT now() NOT NULL,
	"selesai" timestamp with time zone,
	"status" varchar(20) DEFAULT 'berjalan' NOT NULL,
	"ukuran_byte" bigint,
	"lokasi" text,
	"pesan" text
);
--> statement-breakpoint
CREATE INDEX "backup_runs_mulai_idx" ON "backup_runs" USING btree ("mulai");