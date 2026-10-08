import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Profil bimbel: nama, alamat, kontak, dan logo. Bimbel yang memakai aplikasi
// ini cuma satu, jadi isinya satu baris saja — dijaga indeks unik pada ekspresi
// tetap sehingga baris kedua tidak mungkin masuk.
export const bimbelProfile = pgTable(
  "bimbel_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nama: varchar("nama", { length: 120 }).notNull(),
    alamat: varchar("alamat", { length: 240 }).default("").notNull(),
    telepon: varchar("telepon", { length: 40 }).default("").notNull(),
    email: varchar("email", { length: 254 }).default("").notNull(),
    // Logo disimpan sebagai data URL di dalam basis data supaya ikut tersalin
    // saat backup dan tetap tampil di laporan walau aplikasinya dijalankan di
    // jaringan lokal tanpa penyimpanan berkas bersama.
    logo: text("logo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("bimbel_profile_tunggal_idx").on(sql`(true)`),
    // Nama bimbel muncul di kop setiap dokumen, jadi tidak boleh kosong.
    check("bimbel_profile_nama_terisi", sql`length(btrim(${table.nama})) > 0`),
    // Kontak boleh dikosongkan, tapi kalau diisi harus bentuk yang masuk akal.
    check(
      "bimbel_profile_email_valid",
      sql`${table.email} = '' or ${table.email} ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'`,
    ),
    // Logo disimpan sebagai data URL gambar; alamat luar atau skema lain akan
    // gagal dirender di kop dokumen cetak.
    check(
      "bimbel_profile_logo_data_url",
      sql`${table.logo} is null or ${table.logo} like 'data:image/%'`,
    ),
  ],
);
