CREATE TABLE "bimbel_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" varchar(120) NOT NULL,
	"alamat" varchar(240) DEFAULT '' NOT NULL,
	"telepon" varchar(40) DEFAULT '' NOT NULL,
	"email" varchar(254) DEFAULT '' NOT NULL,
	"logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bimbel_profile_tunggal_idx" ON "bimbel_profile" USING btree ((true));