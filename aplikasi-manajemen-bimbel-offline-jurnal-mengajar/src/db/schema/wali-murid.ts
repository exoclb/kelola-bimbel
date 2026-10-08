import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { students } from "./students";
import { user } from "./user";

// Penautan akun wali ke murid. Akun wali memakai tabel `user` (peran
// `orang-tua`), jadi `wali_id` bertipe teks seperti kolom `user.id`; murid
// memakai `students.id` yang berupa UUID. Satu akun boleh tertaut ke lebih dari
// satu anak, dan satu anak boleh punya lebih dari satu wali (mis. ayah dan
// ibu) — karena itu penjaganya pasangan (wali, murid), bukan salah satu kolom
// saja.
export const waliMurid = pgTable(
  "wali_murid",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    waliId: text("wali_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    muridId: uuid("murid_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    // Kapan tautannya dibuat. Isi tautan tidak pernah diubah (hanya dibuat atau
    // dihapus), jadi tidak perlu `updated_at`.
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Satu pasangan wali–murid hanya boleh ada sekali, penjaganya di level
    // basis data supaya penautan ulang dari perangkat mana pun tetap aman.
    uniqueIndex("wali_murid_wali_murid_idx").on(table.waliId, table.muridId),
  ],
);
