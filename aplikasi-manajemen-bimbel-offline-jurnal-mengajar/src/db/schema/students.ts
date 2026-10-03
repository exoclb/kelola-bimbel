import {
  boolean,
  date,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Murid bimbel. Dimatikan lewat `status_aktif`, bukan dihapus, supaya riwayat
// jurnal dan kehadirannya tetap utuh.
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
  (table) => [index("students_nama_idx").on(table.nama)],
);
