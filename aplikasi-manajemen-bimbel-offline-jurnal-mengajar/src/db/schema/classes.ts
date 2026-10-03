import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./user";

// Kelas yang diajarkan di bimbel. `cabang` menandai lokasi bimbelnya, dan
// `guru_id` adalah guru pengampu utama (boleh kosong kalau gurunya berganti).
export const classes = pgTable(
  "classes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    namaKelas: varchar("nama_kelas", { length: 120 }).notNull(),
    cabang: varchar("cabang", { length: 120 }).notNull(),
    guruId: text("guru_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("classes_guru_id_idx").on(table.guruId)],
);
