CREATE TABLE "backup_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"jam" varchar(5) DEFAULT '02:00' NOT NULL,
	"zona_waktu" varchar(64) DEFAULT 'Asia/Jakarta' NOT NULL,
	"retensi_hari" integer DEFAULT 30 NOT NULL,
	"tujuan" varchar(240) DEFAULT '/var/backups/kelola' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "backup_settings_jam_format" CHECK ("backup_settings"."jam" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "backup_settings_retensi_rentang" CHECK ("backup_settings"."retensi_hari" between 1 and 365),
	CONSTRAINT "backup_settings_zona_terisi" CHECK (length(btrim("backup_settings"."zona_waktu")) > 0),
	CONSTRAINT "backup_settings_tujuan_absolut" CHECK ("backup_settings"."tujuan" like '/%')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "backup_settings_tunggal_idx" ON "backup_settings" USING btree ((true));