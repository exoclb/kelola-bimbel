import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Kategori pengeluaran operasional (sewa, listrik/air, alat tulis,
// pemeliharaan, dan seterusnya). Namanya dijaga unik supaya kategori yang sama
// tidak dibuat dua kali dengan ejaan berbeda.
export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nama: varchar("nama", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("expense_categories_nama_idx").on(table.nama),
    // Nama kosong (atau hanya spasi) tidak berguna di daftar pilihan.
    check(
      "expense_categories_nama_terisi",
      sql`length(btrim(${table.nama})) > 0`,
    ),
  ],
);
