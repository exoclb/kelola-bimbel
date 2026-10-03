import {
  index,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { classes } from "./classes";
import { user } from "./user";

// Jadwal mengajar satu kelas pada satu hari. Halaman "Isi Jurnal Hari Ini"
// membaca tabel ini untuk tahu kelas apa saja yang harus diisi guru hari ini.
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    guruId: text("guru_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hari: varchar("hari", { length: 10 }).notNull(),
    jamMulai: time("jam_mulai").notNull(),
    jamSelesai: time("jam_selesai").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("schedules_guru_hari_jam_idx").on(
      table.guruId,
      table.hari,
      table.jamMulai,
    ),
  ],
);
