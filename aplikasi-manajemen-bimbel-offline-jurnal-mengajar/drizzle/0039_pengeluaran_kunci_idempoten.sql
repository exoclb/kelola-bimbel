ALTER TABLE "expenses" ADD COLUMN "kunci" varchar(160);--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_kunci_unik_idx" ON "expenses" USING btree ("kunci");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_kunci_terisi" CHECK ("expenses"."kunci" is null or length(btrim("expenses"."kunci")) > 0);