import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Pengaturan jadwal backup: menyalakan/mematikan backup otomatis, jam serta
// zona waktu jalannya, berapa lama salinannya disimpan, dan di mana berkasnya
// diletakkan. Bimbel yang memakai aplikasi ini cuma satu, jadi isinya satu
// baris saja — dijaga indeks unik pada ekspresi tetap sehingga pengaturan
// kedua tidak mungkin masuk, sama seperti `bimbel_profile`.
//
// Nilai bawaannya harus sejalan dengan `JADWAL_BACKUP_BAWAAN` di
// `src/lib/jadwal-backup.ts`; kesamaannya dikunci `tests/jadwal-backup.test.mjs`.
export const backupSettings = pgTable(
  "backup_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    aktif: boolean("aktif").default(true).notNull(),
    // Jam mulai "HH:MM" 24 jam menurut `zona_waktu`.
    jam: varchar("jam", { length: 5 }).default("02:00").notNull(),
    // Nama zona waktu IANA (mis. "Asia/Jakarta"). Keberadaannya tidak dijaga
    // batasan basis data — daftar zona di PostgreSQL bergantung pemasangan —
    // melainkan di validator dan layanan.
    zonaWaktu: varchar("zona_waktu", { length: 64 })
      .default("Asia/Jakarta")
      .notNull(),
    // Umur berkas backup sebelum dihapus penjadwal, dalam hari.
    retensiHari: integer("retensi_hari").default(30).notNull(),
    // Direktori salinan di server, ditulis sebagai path lengkap.
    tujuan: varchar("tujuan", { length: 240 })
      .default("/var/backups/kelola")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("backup_settings_tunggal_idx").on(sql`(true)`),
    // Jamnya dipakai penjadwal untuk menghitung waktu jalan, jadi bentuknya
    // dijaga: dua angka jam 00–23, titik dua, dua angka menit.
    check(
      "backup_settings_jam_format",
      sql`${table.jam} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
    // Retensi minimal sehari supaya salinan terakhir tidak ikut terhapus;
    // batas atasnya sepadan dengan isian yang diterima formulir.
    check(
      "backup_settings_retensi_rentang",
      sql`${table.retensiHari} between 1 and 365`,
    ),
    check(
      "backup_settings_zona_terisi",
      sql`length(btrim(${table.zonaWaktu})) > 0`,
    ),
    // Tempat penyimpanan harus path absolut: penjadwal menjalankannya dari
    // direktori kerja yang berbeda-beda.
    check("backup_settings_tujuan_absolut", sql`${table.tujuan} like '/%'`),
  ],
);
