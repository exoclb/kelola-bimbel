import {
  date,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Tarif gaji guru per jam. Tarif bisa berubah, jadi barisnya menyimpan riwayat:
// tarif yang berlaku untuk sebuah jurnal adalah baris dengan `berlaku_sejak`
// terbaru yang tidak melewati tanggal jurnal itu. Rekap gaji menyimpan tarif
// yang dipakai sebagai salinan, sehingga angka lama tidak ikut berubah.
export const salarySettings = pgTable(
  "salary_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tarifPerJam: numeric("tarif_per_jam", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    // Mis. "per jam" atau "tetap" — menentukan cara gaji dihitung.
    skema: varchar("skema", { length: 40 }).default("per jam").notNull(),
    berlakuSejak: date("berlaku_sejak").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Satu tarif per tanggal berlaku; indeksnya sekaligus melayani pencarian
    // tarif terbaru (urut menurun) tanpa indeks tambahan.
    uniqueIndex("salary_settings_berlaku_sejak_idx").on(table.berlakuSejak),
  ],
);
