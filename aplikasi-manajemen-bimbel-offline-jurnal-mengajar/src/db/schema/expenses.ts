import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
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
    // Kunci idempotensi dari klien (mis. penanda formulir sekali kirim). Satu
    // kiriman yang diulang — tombol tertekan dua kali, percobaan ulang sesudah
    // jaringan putus — hanya menghasilkan satu baris. `null` kalau klien tidak
    // mengirim kunci: indeks unik mengabaikan nilai kosong, jadi baris lama dan
    // pemanggil lama tidak pernah bentrok.
    kunci: varchar("kunci", { length: 160 }),
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
    // Penjaga idempotensi: satu kunci kiriman hanya boleh menghasilkan satu
    // baris, walau permintaannya diulang atau dua percobaan berjalan bersamaan.
    // Yang menjaga adalah basis data, bukan pemeriksaan di aplikasi.
    uniqueIndex("expenses_kunci_unik_idx").on(table.kunci),
    // Nominal pengeluaran tidak boleh negatif.
    check("expenses_nominal_tidak_negatif", sql`${table.nominal} >= 0`),
    // Tanggalnya harus masuk akal; salah tulis tahun membuat pengeluaran
    // hilang dari rekap periode yang sebenarnya.
    check(
      "expenses_tanggal_masuk_akal",
      sql`${table.tanggal} between date '2000-01-01' and date '2100-12-31'`,
    ),
    // Kunci kosong bukan "tanpa kunci" (yang memang boleh), melainkan kiriman
    // yang salah satu: dua pengeluaran berlainan akan dianggap kiriman yang
    // sama dan yang kedua tidak pernah tercatat. Jadi yang boleh hanya `null`
    // atau kunci yang benar-benar berisi.
    check(
      "expenses_kunci_terisi",
      sql`${table.kunci} is null or length(btrim(${table.kunci})) > 0`,
    ),
  ],
);
