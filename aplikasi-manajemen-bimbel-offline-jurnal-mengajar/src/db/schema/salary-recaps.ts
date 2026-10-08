import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const statusPembayaranGaji = pgEnum("status_pembayaran_gaji", [
  "belum_dibayar",
  "dibayar",
]);

// Catatan pembayaran gaji per guru per bulan. Angka jam, tarif, dan total di
// sini adalah salinan saat pembayaran ditandai — dipakai sebagai bukti (audit)
// kalau data jurnal berubah setelahnya. Angka yang ditampilkan sehari-hari
// tetap dihitung langsung dari jurnal.
export const salaryRecaps = pgTable(
  "salary_recaps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guruId: text("guru_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    periodeBulan: varchar("periode_bulan", { length: 7 }).notNull(),
    totalJam: numeric("total_jam", {
      precision: 6,
      scale: 2,
      mode: "number",
    }).notNull(),
    tarifPerJam: numeric("tarif_per_jam", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    totalGaji: numeric("total_gaji", {
      precision: 14,
      scale: 2,
      mode: "number",
    }).notNull(),
    statusPembayaran: statusPembayaranGaji("status_pembayaran")
      .default("belum_dibayar")
      .notNull(),
    tanggalDibayar: date("tanggal_dibayar"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Satu catatan per guru per bulan, sehingga menandai pembayaran dua kali
    // memperbarui baris yang sama.
    uniqueIndex("salary_recaps_guru_periode_idx").on(
      table.guruId,
      table.periodeBulan,
    ),
    index("salary_recaps_periode_idx").on(table.periodeBulan),
    // Periode selalu `YYYY-MM` (bulan 01–12); salah tulis di sini membuat rekap
    // gaji bulan itu tidak pernah ketemu.
    check(
      "salary_recaps_periode_format",
      sql`${table.periodeBulan} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
    // Salinan angka saat pembayaran ditandai tidak boleh negatif.
    check(
      "salary_recaps_angka_tidak_negatif",
      sql`${table.totalJam} >= 0 and ${table.tarifPerJam} >= 0 and ${table.totalGaji} >= 0`,
    ),
    // Status "dibayar" wajib punya tanggal bayarnya.
    check(
      "salary_recaps_tanggal_dibayar_konsisten",
      sql`${table.statusPembayaran} = 'belum_dibayar' or ${table.tanggalDibayar} is not null`,
    ),
  ],
);
