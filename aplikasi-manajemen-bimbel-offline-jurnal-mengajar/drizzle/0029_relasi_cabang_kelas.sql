-- Relasi kelas → cabang: `classes.cabang` menyimpan nama cabang, jadi namanya
-- harus ada di tabel `cabang`. Batasan unik ditulis lebih dulu karena foreign
-- key memerlukannya sebagai sasaran (indeks unik ekspresi
-- `cabang_nama_unik_idx` tidak bisa dipakai FK), lalu datanya dirapikan supaya
-- basis data yang sudah berisi kelas tidak kehilangan atau menyandera data.
ALTER TABLE "cabang" ADD CONSTRAINT "cabang_nama_unique" UNIQUE("nama");--> statement-breakpoint
-- 1) Nama cabang yang dipakai kelas tetapi belum terdaftar didaftarkan apa
--    adanya sebagai cabang aktif, supaya kelas yang sudah berjalan tidak
--    terhalang; alamat dan kontaknya diisi penanda agar lolos pemeriksaan
--    isian, dan pemilik bisa melengkapinya di halaman cabang. Varian yang hanya
--    beda huruf besar-kecil/spasi cukup didaftarkan sekali (`group by`), lalu
--    langkah 2 menyamakan nama kelasnya.
INSERT INTO "cabang" ("nama", "alamat", "kontak", "status_aktif") SELECT min(btrim("classes"."cabang")), 'Belum diisi', '-', true FROM "classes" WHERE NOT EXISTS (SELECT 1 FROM "cabang" WHERE lower(btrim("cabang"."nama")) = lower(btrim("classes"."cabang"))) AND length(btrim("classes"."cabang")) <= 80 GROUP BY lower(btrim("classes"."cabang"));--> statement-breakpoint
-- 2) Nama kelas yang hanya beda huruf besar-kecil atau spasi disamakan dengan
--    nama kanonik baris cabangnya, jadi relasinya tidak putus karena perbedaan
--    penulisan.
UPDATE "classes" SET "cabang" = "cabang"."nama" FROM "cabang" WHERE lower(btrim("classes"."cabang")) = lower(btrim("cabang"."nama")) AND "classes"."cabang" <> "cabang"."nama";--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_cabang_cabang_nama_fk" FOREIGN KEY ("cabang") REFERENCES "public"."cabang"("nama") ON DELETE restrict ON UPDATE cascade;
