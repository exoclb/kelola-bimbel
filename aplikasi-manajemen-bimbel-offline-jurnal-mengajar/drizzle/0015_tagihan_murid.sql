CREATE TYPE "public"."status_tagihan" AS ENUM('belum_lunas', 'lunas');--> statement-breakpoint
CREATE TABLE "student_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"periode_bulan" integer NOT NULL,
	"periode_tahun" integer NOT NULL,
	"nominal" numeric(12, 2) NOT NULL,
	"status" "status_tagihan" DEFAULT 'belum_lunas' NOT NULL,
	"tanggal_bayar" date,
	"sudah_diingatkan" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_invoices" ADD CONSTRAINT "student_invoices_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_invoices_murid_periode_idx" ON "student_invoices" USING btree ("student_id","periode_bulan","periode_tahun");--> statement-breakpoint
CREATE INDEX "student_invoices_periode_idx" ON "student_invoices" USING btree ("periode_tahun","periode_bulan");