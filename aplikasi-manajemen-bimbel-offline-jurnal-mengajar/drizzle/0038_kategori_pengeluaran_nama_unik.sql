-- Satu kategori pengeluaran hanya boleh punya satu nama, walau bedanya cuma
-- huruf besar/kecil atau spasi di tepi. Alasannya konkret: rekap pengeluaran
-- dikelompokkan menurut nama kategori (`totalPerKategori` di
-- `src/lib/pengeluaran.ts`), jadi "Listrik" dan "listrik" tampil sebagai dua
-- baris terpisah dengan total yang seharusnya satu. Penjaganya indeks unik
-- pada ekspresi `lower(btrim(nama))`, pola yang sama dengan
-- `cabang_nama_unik_idx` (lihat `drizzle/0028_cabang_nama_unik.sql`).
--
-- Basis data yang sudah berisi data dibereskan lebih dulu supaya pemasangan
-- indeksnya tidak gagal: 1) pengeluaran dari varian penulisan mana pun
-- diarahkan ke kategori kanoniknya, lalu 2) baris kategori varian yang sudah
-- tidak dipakai dihapus. Kategori kanoniknya adalah baris dengan nama yang
-- sudah rapi (tanpa spasi tepi), terlama dibuat — supaya riwayatnya yang paling
-- panjang tetap menempel di baris yang bertahan.
UPDATE "expenses"
   SET "kategori_id" = "kanonik"."id"
  FROM "expense_categories" AS "varian",
       (
         SELECT DISTINCT ON (lower(btrim("nama"))) "id",
                lower(btrim("nama")) AS "kunci"
           FROM "expense_categories"
          ORDER BY lower(btrim("nama")),
                   ("nama" = btrim("nama")) DESC,
                   "created_at",
                   "id"
       ) AS "kanonik"
 WHERE "expenses"."kategori_id" = "varian"."id"
   AND "kanonik"."kunci" = lower(btrim("varian"."nama"))
   AND "kanonik"."id" <> "varian"."id";--> statement-breakpoint
DELETE FROM "expense_categories" AS "varian"
 WHERE EXISTS (
         SELECT 1
           FROM (
             SELECT DISTINCT ON (lower(btrim("nama"))) "id",
                    lower(btrim("nama")) AS "kunci"
               FROM "expense_categories"
              ORDER BY lower(btrim("nama")),
                       ("nama" = btrim("nama")) DESC,
                       "created_at",
                       "id"
           ) AS "kanonik"
          WHERE "kanonik"."kunci" = lower(btrim("varian"."nama"))
            AND "kanonik"."id" <> "varian"."id"
       );--> statement-breakpoint
DROP INDEX "expense_categories_nama_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_nama_unik_idx" ON "expense_categories" USING btree (lower(btrim("nama")));
