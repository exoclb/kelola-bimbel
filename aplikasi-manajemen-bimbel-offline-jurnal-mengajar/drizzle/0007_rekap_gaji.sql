CREATE TYPE "public"."status_pembayaran_gaji" AS ENUM('belum_dibayar', 'dibayar');--> statement-breakpoint
CREATE TABLE "salary_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guru_id" text NOT NULL,
	"periode_bulan" varchar(7) NOT NULL,
	"total_jam" numeric(6, 2) NOT NULL,
	"tarif_per_jam" numeric(12, 2) NOT NULL,
	"total_gaji" numeric(14, 2) NOT NULL,
	"status_pembayaran" "status_pembayaran_gaji" DEFAULT 'belum_dibayar' NOT NULL,
	"tanggal_dibayar" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salary_recaps" ADD CONSTRAINT "salary_recaps_guru_id_user_id_fk" FOREIGN KEY ("guru_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "salary_recaps_guru_periode_idx" ON "salary_recaps" USING btree ("guru_id","periode_bulan");--> statement-breakpoint
CREATE INDEX "salary_recaps_periode_idx" ON "salary_recaps" USING btree ("periode_bulan");