import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
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
  ],
);
