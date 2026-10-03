-- Akun lama yang belum punya peran diisi peran bawaan (guru) sebelum kolomnya
-- diwajibkan, supaya migrasi ini aman dijalankan pada basis data yang sudah ada.
UPDATE "user" SET "role" = 'user' WHERE "role" IS NULL;
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");
