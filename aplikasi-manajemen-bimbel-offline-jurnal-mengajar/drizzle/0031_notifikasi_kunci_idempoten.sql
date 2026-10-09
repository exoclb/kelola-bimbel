ALTER TABLE "notifications" ADD COLUMN "kunci" varchar(160);--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_tipe_kunci_idx" ON "notifications" USING btree ("user_id","tipe","kunci");