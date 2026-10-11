import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Murid bimbel. Dimatikan lewat `status_aktif`, bukan dihapus, supaya riwayat
// jurnal dan kehadirannya tetap utuh.
//
// `tanggal_lahir` sengaja boleh kosong di tingkat tabel: data murid lama dan
// seeder ringkasan menulis baris tanpa kolom itu, sedangkan formulir dan API
// (`createMuridSchema`) tetap mewajibkannya. Yang dijaga basis data adalah
// namanya, karena baris tanpa nama tidak bisa dicari, ditampilkan, maupun
// ditagih.
export const students = pgTable(
  "students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nama: varchar("nama", { length: 120 }).notNull(),
    tanggalLahir: date("tanggal_lahir"),
    namaOrangTua: varchar("nama_orang_tua", { length: 120 }),
    kontakOrangTua: varchar("kontak_orang_tua", { length: 40 }),
    statusAktif: boolean("status_aktif").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("students_nama_idx").on(table.nama),
    // Nama murid dipakai sebagai penanda baris di daftar murid, pilihan
    // penempatan, tagihan, dan seluruh laporan — isian kosong (mis. hanya
    // spasi) membuat barisnya tak bisa dikenali. Validator formulir dan API
    // sudah menolaknya; di sini dijaga ulang supaya penulisan langsung ke basis
    // data pun aman, sama seperti `cabang_*_terisi`.
    check("students_nama_terisi", sql`length(btrim(${table.nama})) > 0`),
  ],
);
