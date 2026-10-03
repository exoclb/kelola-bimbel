CREATE TYPE "public"."status_jurnal" AS ENUM('terkirim', 'direview');--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama_kelas" varchar(120) NOT NULL,
	"cabang" varchar(120) NOT NULL,
	"guru_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" varchar(120) NOT NULL,
	"tanggal_lahir" date,
	"nama_orang_tua" varchar(120),
	"kontak_orang_tua" varchar(40),
	"status_aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"guru_id" text NOT NULL,
	"hari" varchar(10) NOT NULL,
	"jam_mulai" time NOT NULL,
	"jam_selesai" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaching_journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guru_id" text NOT NULL,
	"class_id" uuid NOT NULL,
	"schedule_id" uuid,
	"tanggal" date NOT NULL,
	"materi" varchar(200) NOT NULL,
	"catatan" text DEFAULT '' NOT NULL,
	"jam_mengajar" numeric(4, 2) NOT NULL,
	"status" "status_jurnal" DEFAULT 'terkirim' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"hadir" boolean DEFAULT true NOT NULL,
	"catatan" varchar(200) DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_guru_id_user_id_fk" FOREIGN KEY ("guru_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_guru_id_user_id_fk" FOREIGN KEY ("guru_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_journals" ADD CONSTRAINT "teaching_journals_guru_id_user_id_fk" FOREIGN KEY ("guru_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_journals" ADD CONSTRAINT "teaching_journals_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_journals" ADD CONSTRAINT "teaching_journals_schedule_id_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_attendances" ADD CONSTRAINT "journal_attendances_journal_id_teaching_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."teaching_journals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_attendances" ADD CONSTRAINT "journal_attendances_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_guru_id_idx" ON "classes" USING btree ("guru_id");--> statement-breakpoint
CREATE INDEX "students_nama_idx" ON "students" USING btree ("nama");--> statement-breakpoint
CREATE INDEX "schedules_guru_hari_jam_idx" ON "schedules" USING btree ("guru_id","hari","jam_mulai");--> statement-breakpoint
CREATE INDEX "teaching_journals_guru_tanggal_idx" ON "teaching_journals" USING btree ("guru_id","tanggal" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "teaching_journals_class_tanggal_idx" ON "teaching_journals" USING btree ("class_id","tanggal" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "journal_attendances_journal_student_idx" ON "journal_attendances" USING btree ("journal_id","student_id");