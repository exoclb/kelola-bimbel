CREATE TABLE "student_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"guru_id" text NOT NULL,
	"tanggal" date NOT NULL,
	"nilai" numeric(5, 2) NOT NULL,
	"sikap" text NOT NULL,
	"catatan_perkembangan" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_guru_id_user_id_fk" FOREIGN KEY ("guru_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_progress_student_tanggal_idx" ON "student_progress" USING btree ("student_id","tanggal");--> statement-breakpoint
CREATE INDEX "student_progress_guru_idx" ON "student_progress" USING btree ("guru_id");