import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

// Preferensi notifikasi per akun: jenis notifikasi apa yang ingin diterima.
// Baris dibuat saat akun pertama kali mengubah pengaturannya.
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jenisNotifikasi: varchar("jenis_notifikasi", { length: 40 }).notNull(),
    aktif: boolean("aktif").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Satu akun hanya punya satu baris per jenis notifikasi.
    uniqueIndex("notification_preferences_user_jenis_idx").on(
      table.userId,
      table.jenisNotifikasi,
    ),
  ],
);
