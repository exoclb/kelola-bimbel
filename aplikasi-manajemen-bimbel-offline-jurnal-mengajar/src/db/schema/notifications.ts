import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

// Pemberitahuan untuk satu akun — dipakai owner untuk kabar "jurnal baru
// masuk" dan "kelas belum diisi". `tipe` memakai nilai tetap seperti
// "jurnal_baru" atau "kelas_kosong".
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tipe: varchar("tipe", { length: 40 }).notNull(),
    pesan: text("pesan").notNull(),
    // Identitas peristiwa yang memicu notifikasi (mis. id jurnal, atau
    // "<guruId>:<periode>" untuk honor satu periode). Satu peristiwa hanya
    // boleh menghasilkan satu baris per akun. Bernilai `null` untuk notifikasi
    // yang dibuat tanpa kunci — indeks unik mengabaikan nilai kosong, jadi
    // baris lama dan pemanggilan lama tidak pernah bentrok.
    kunci: varchar("kunci", { length: 160 }),
    sudahDibaca: boolean("sudah_dibaca").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Daftar "belum dibaca, terbaru dulu" adalah bacaan yang paling sering.
    index("notifications_user_dibaca_created_idx").on(
      table.userId,
      table.sudahDibaca,
      table.createdAt.desc(),
    ),
    index("notifications_user_created_idx").on(
      table.userId,
      table.createdAt.desc(),
    ),
    // Penjaga idempotensi: satu peristiwa (`kunci`) satu jenis hanya sekali
    // untuk tiap akun, walau aksinya diulang atau berjalan bersamaan.
    uniqueIndex("notifications_user_tipe_kunci_idx").on(
      table.userId,
      table.tipe,
      table.kunci,
    ),
    // Pemberitahuan tanpa tipe atau pesan tidak bisa ditampilkan maupun
    // dikelompokkan, jadi tidak boleh masuk sama sekali.
    check("notifications_tipe_terisi", sql`length(btrim(${table.tipe})) > 0`),
    check("notifications_pesan_terisi", sql`length(btrim(${table.pesan})) > 0`),
    // Kunci peristiwa yang kosong bukan "tanpa kunci" (yang memang boleh),
    // melainkan peristiwa yang salah satu: semua peristiwa bertipe sama akan
    // dianggap peristiwa yang sama dan notifikasinya diam-diam hilang. Jadi
    // yang boleh hanya `null` atau kunci yang benar-benar berisi.
    check(
      "notifications_kunci_terisi",
      sql`${table.kunci} is null or length(btrim(${table.kunci})) > 0`,
    ),
  ],
);
