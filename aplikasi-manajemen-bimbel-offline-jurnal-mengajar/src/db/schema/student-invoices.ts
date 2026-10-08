import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { students } from "./students";

// 'belum_lunas' = tagihan masih berjalan, 'lunas' = sudah dibayar dan
// `tanggal_bayar` terisi.
export const statusTagihan = pgEnum("status_tagihan", ["belum_lunas", "lunas"]);

// Tagihan SPP bulanan murid. Satu murid hanya boleh punya satu tagihan per
// periode (bulan + tahun) supaya penagihan tidak ganda — penjaganya indeks
// unik di level basis data, bukan hanya validasi di tampilan, agar tetap
// berlaku walau dibuat dari perangkat berbeda.
export const studentInvoices = pgTable(
  "student_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    periodeBulan: integer("periode_bulan").notNull(),
    periodeTahun: integer("periode_tahun").notNull(),
    nominal: numeric("nominal", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    status: statusTagihan("status").default("belum_lunas").notNull(),
    // Diisi hanya kalau statusnya "lunas".
    tanggalBayar: date("tanggal_bayar"),
    // Penanda bahwa pengingat tunggakan untuk tagihan ini sudah dikirim.
    sudahDiingatkan: boolean("sudah_diingatkan").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("student_invoices_murid_periode_idx").on(
      table.studentId,
      table.periodeBulan,
      table.periodeTahun,
    ),
    // Dipakai daftar dan rekap per periode.
    index("student_invoices_periode_idx").on(
      table.periodeTahun,
      table.periodeBulan,
    ),
    // Nominal tagihan tidak boleh negatif.
    check("student_invoices_nominal_tidak_negatif", sql`${table.nominal} >= 0`),
    // Periode harus bulan 1–12 pada tahun yang masuk akal; salah tulis di sini
    // membuat tagihan tidak pernah ketemu di rekap periodenya.
    check(
      "student_invoices_periode_valid",
      sql`${table.periodeBulan} between 1 and 12 and ${table.periodeTahun} between 2000 and 2100`,
    ),
    // Status "lunas" dan tanggal bayarnya harus konsisten dua arah.
    check(
      "student_invoices_tanggal_bayar_konsisten",
      sql`(${table.status} = 'lunas') = (${table.tanggalBayar} is not null)`,
    ),
  ],
);
