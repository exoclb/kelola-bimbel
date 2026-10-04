import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Catatan setiap kali backup database dijalankan. Skrip backup menulis satu
// baris saat mulai (status `berjalan`) lalu memperbaruinya saat selesai, jadi
// halaman monitoring bisa menunjukkan backup terakhir yang berhasil sekaligus
// menangkap proses yang gagal di tengah jalan.
export const backupRuns = pgTable(
  "backup_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Waktu mulai dan selesai; `selesai` masih kosong selama proses berjalan.
    mulai: timestamp("mulai", { withTimezone: true }).defaultNow().notNull(),
    selesai: timestamp("selesai", { withTimezone: true }),
    // "berjalan" | "sukses" | "gagal" — disimpan sebagai teks supaya status
    // baru tidak menuntut migrasi enum.
    status: varchar("status", { length: 20 }).default("berjalan").notNull(),
    // Ukuran berkas hasil backup, dan di mana salinannya disimpan (mis. path
    // di penyimpanan objek atau direktori cadangan terpisah).
    ukuranByte: bigint("ukuran_byte", { mode: "number" }),
    lokasi: text("lokasi"),
    // Keterangan tambahan: pesan galat, atau catatan retensi/pemulihan.
    pesan: text("pesan"),
  },
  (table) => [index("backup_runs_mulai_idx").on(table.mulai)],
);
