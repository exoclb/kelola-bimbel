CREATE TABLE "cabang" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" varchar(80) NOT NULL,
	"alamat" varchar(240) NOT NULL,
	"kontak" varchar(40) NOT NULL,
	"status_aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cabang_nama_terisi" CHECK (length(btrim("cabang"."nama")) > 0),
	CONSTRAINT "cabang_alamat_terisi" CHECK (length(btrim("cabang"."alamat")) > 0),
	CONSTRAINT "cabang_kontak_terisi" CHECK (length(btrim("cabang"."kontak")) > 0)
);
