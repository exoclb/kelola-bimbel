CREATE TYPE "public"."status_penempatan" AS ENUM('aktif', 'selesai');--> statement-breakpoint
CREATE TABLE "student_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"tanggal_mulai" date NOT NULL,
	"status" "status_penempatan" DEFAULT 'aktif' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_enrollments_student_aktif_idx" ON "student_enrollments" USING btree ("student_id") WHERE "student_enrollments"."status" = 'aktif';--> statement-breakpoint
CREATE INDEX "student_enrollments_class_status_idx" ON "student_enrollments" USING btree ("class_id","status");