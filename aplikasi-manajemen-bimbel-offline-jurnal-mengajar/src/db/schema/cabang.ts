import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Cabang bimbel: lokasi tempat kelas diadakan. Bentuk kolomnya mengikuti bentuk
// `Cabang` yang dipakai layanan cabang (`src/services/cabang.service.ts`) dan
// API-nya, jadi sumbernya bisa dipindah tanpa mengubah hasil yang dibaca
// tampilan. Data awalnya ada di `src/lib/mock-cabang.ts`.
//
// `nama` dipakai sebagai penanda cabang pada kolom `classes.cabang`, jadi
// panjangnya dibatasi sama seperti validasi formulir (80 karakter) dan isinya
// tidak boleh kosong.
export const cabang = pgTable(
  "cabang",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nama: varchar("nama", { length: 80 }).notNull(),
    alamat: varchar("alamat", { length: 240 }).notNull(),
    kontak: varchar("kontak", { length: 40 }).notNull(),
    // Cabang nonaktif tetap terdaftar, tetapi tidak dipakai untuk kelas baru.
    statusAktif: boolean("status_aktif").default(true).notNull(),
    // Penanda waktu pembuatan dan perubahan terakhir barisnya.
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Nama cabang jadi penanda barisnya di daftar, di pilihan formulir kelas,
    // dan di kolom `classes.cabang`. Dua cabang karena itu tidak boleh punya
    // nama yang sama, termasuk kalau bedanya hanya huruf besar/kecil atau spasi
    // di tepi. Penjaganya indeks unik pada ekspresi `lower(btrim(nama))`, sama
    // dengan pembanding yang dipakai layanan cabang saat memeriksa duplikat.
    uniqueIndex("cabang_nama_unik_idx").on(sql`lower(btrim(${table.nama}))`),
    // Nama, alamat, dan kontak selalu ditampilkan di daftar cabang maupun kop
    // dokumen, jadi baris yang isinya kosong (mis. hanya spasi) tidak boleh
    // masuk walau lewat jalur selain formulir.
    check("cabang_nama_terisi", sql`length(btrim(${table.nama})) > 0`),
    check("cabang_alamat_terisi", sql`length(btrim(${table.alamat})) > 0`),
    check("cabang_kontak_terisi", sql`length(btrim(${table.kontak})) > 0`),
  ],
);
