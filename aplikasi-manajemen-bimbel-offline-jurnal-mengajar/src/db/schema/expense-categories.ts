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
    // Nama kategori dipakai sebagai label baris di rekap per kategori
    // (`totalPerKategori` mengelompokkan menurut namanya), jadi dua kategori
    // tidak boleh sama walau bedanya hanya huruf besar/kecil atau spasi di tepi:
    // "Listrik" dan "listrik" akan tampil sebagai dua baris terpisah dengan
    // total yang seharusnya satu. Penjaganya indeks unik pada ekspresi
    // `lower(btrim(nama))`, pola yang sama dengan `cabang_nama_unik_idx`. Layanan
    // (`tambahKategoriPengeluaran`) sudah menangkap pelanggaran unik itu dan
    // menjawab pesan "sudah ada", jadi pengguna tidak pernah melihat galat
    // kunci basis data.
    uniqueIndex("expense_categories_nama_unik_idx").on(
      sql`lower(btrim(${table.nama}))`,
    ),
    // Nama kosong (atau hanya spasi) tidak berguna di daftar pilihan.
    check(
      "expense_categories_nama_terisi",
      sql`length(btrim(${table.nama})) > 0`,
    ),
  ],
);
