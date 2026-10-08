CREATE TABLE "wali_murid" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wali_id" text NOT NULL,
	"murid_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jejak_baca_portal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wali_id" text NOT NULL,
	"murid_id" uuid NOT NULL,
	"bagian" text NOT NULL,
	"dibaca_pada" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wali_murid" ADD CONSTRAINT "wali_murid_wali_id_user_id_fk" FOREIGN KEY ("wali_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wali_murid" ADD CONSTRAINT "wali_murid_murid_id_students_id_fk" FOREIGN KEY ("murid_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jejak_baca_portal" ADD CONSTRAINT "jejak_baca_portal_wali_id_user_id_fk" FOREIGN KEY ("wali_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jejak_baca_portal" ADD CONSTRAINT "jejak_baca_portal_murid_id_students_id_fk" FOREIGN KEY ("murid_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wali_murid_wali_murid_idx" ON "wali_murid" USING btree ("wali_id","murid_id");--> statement-breakpoint
CREATE UNIQUE INDEX "jejak_baca_portal_wali_murid_bagian_idx" ON "jejak_baca_portal" USING btree ("wali_id","murid_id","bagian");