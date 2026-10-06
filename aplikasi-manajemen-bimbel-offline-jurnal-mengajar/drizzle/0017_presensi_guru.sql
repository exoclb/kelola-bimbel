CREATE TYPE "public"."status_kehadiran_guru" AS ENUM('hadir', 'izin', 'tidak_hadir', 'digantikan');--> statement-breakpoint
CREATE TABLE "teacher_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guru_id" text NOT NULL,
	"schedule_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"status" "status_kehadiran_guru" DEFAULT 'hadir' NOT NULL,
	"guru_pengganti_id" text,
	"catatan" text,
	"diubah_oleh_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teacher_attendances" ADD CONSTRAINT "teacher_attendances_guru_id_user_id_fk" FOREIGN KEY ("guru_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_attendances" ADD CONSTRAINT "teacher_attendances_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_attendances" ADD CONSTRAINT "teacher_attendances_guru_pengganti_id_user_id_fk" FOREIGN KEY ("guru_pengganti_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_attendances" ADD CONSTRAINT "teacher_attendances_diubah_oleh_id_user_id_fk" FOREIGN KEY ("diubah_oleh_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_attendances_guru_jadwal_tanggal_idx" ON "teacher_attendances" USING btree ("guru_id","schedule_id","tanggal");--> statement-breakpoint
CREATE INDEX "teacher_attendances_tanggal_idx" ON "teacher_attendances" USING btree ("tanggal");