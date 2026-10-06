import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { expenseCategories } from "./expense-categories";

// Pengeluaran operasional bimbel (sewa, listrik/air, alat tulis,
// pemeliharaan). Kategorinya diambil dari tabel `expense_categories` dan tidak
// boleh dihapus selama masih dipakai — `restrict` mencegah riwayat pengeluaran
// ikut hilang tanpa sengaja.
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kategoriId: uuid("kategori_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict" }),
    nominal: numeric("nominal", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    tanggal: date("tanggal").notNull(),
    catatan: text("catatan"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Dipakai daftar dan rekap per periode (urut tanggal).
    index("expenses_tanggal_idx").on(table.tanggal),
    // Dipakai saringan per kategori dan penjagaan relasi.
    index("expenses_kategori_idx").on(table.kategoriId),
  ],
);
