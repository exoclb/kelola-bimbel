import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { cabang } from "./cabang";
import { user } from "./user";

// Kelas yang diajarkan di bimbel. `cabang` menandai lokasi bimbelnya dan
// menunjuk nama di tabel `cabang`, dan `guru_id` adalah guru pengampu utama
// (boleh kosong kalau gurunya berganti).
//
// Nama cabang disimpan apa adanya (bukan id) supaya daftar kelas, jurnal, dan
// laporan tetap membacanya seperti sebelumnya. Ganti nama cabang ikut
// memindahkan kelasnya (`on update cascade`), dan cabang yang masih dipakai
// kelas tidak bisa dihapus (`on delete restrict`) — aplikasinya memang tidak
// menghapus cabang, hanya menonaktifkannya.
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    namaKelas: varchar("nama_kelas", { length: 120 }).notNull(),
    cabang: varchar("cabang", { length: 120 })
      .notNull()
      .references(() => cabang.nama, {
        onUpdate: "cascade",
        onDelete: "restrict",
      }),
    guruId: text("guru_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("classes_guru_id_idx").on(table.guruId),
    // Wajib ada untuk kolom yang jadi sasaran foreign key: setiap kali nama
    // cabang diganti atau barisnya dihapus, PostgreSQL memeriksa kelas yang
    // menunjuknya (`on update cascade` / `on delete restrict`) — tanpa indeks
    // ini pemeriksaannya memindai seluruh tabel `classes`.
    index("classes_cabang_idx").on(table.cabang),
    // Nama kelas dipakai sebagai penanda kelas di jadwal, jurnal, penempatan
    // murid, dan laporan, jadi baris tanpa nama tidak bisa dikenali di mana pun.
    // Validator formulir dan API sudah menolaknya; di sini dijaga ulang supaya
    // penulisan langsung ke basis data pun aman.
    check(
      "classes_nama_kelas_terisi",
      sql`length(btrim(${table.namaKelas})) > 0`,
    ),
  ],
);
