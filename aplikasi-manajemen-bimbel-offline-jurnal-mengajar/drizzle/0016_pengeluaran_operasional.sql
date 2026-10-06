CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kategori_id" uuid NOT NULL,
	"nominal" numeric(12, 2) NOT NULL,
	"tanggal" date NOT NULL,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_kategori_id_expense_categories_id_fk" FOREIGN KEY ("kategori_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_nama_idx" ON "expense_categories" USING btree ("nama");--> statement-breakpoint
CREATE INDEX "expenses_tanggal_idx" ON "expenses" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "expenses_kategori_idx" ON "expenses" USING btree ("kategori_id");