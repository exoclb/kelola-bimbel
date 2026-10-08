import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { students } from "./students";
import { user } from "./user";

// Jejak baca Portal Wali: kapan tiap akun wali terakhir membuka tiap bagian
// (kehadiran/perkembangan/tagihan) tiap anaknya. Kuncinya per akun wali, bukan
// per anak, supaya dua wali yang menautkan anak yang sama tidak saling menutup
// penanda "baru".
//
// `bagian` sengaja bertipe text, bukan enum: daftar bagian hidup di
// `src/lib/mock-portal-wali.ts` (`BAGIAN_PORTAL`) dan bisa bertambah tanpa
// migrasi baru.
export const jejakBacaPortal = pgTable(
  "jejak_baca_portal",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    waliId: text("wali_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    muridId: uuid("murid_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    bagian: text("bagian").notNull(),
    // Waktu baca lengkap (dengan zona waktu), bukan lagi tanggal saja. Aturan
    // "baru" adalah `terbaru > terakhirDibaca`; dengan granularitas hari, isi
    // yang muncul dan dibaca di hari yang sama tidak akan pernah bertanda
    // "baru". Perbandingan tetap dinormalkan ke resolusi hari di layanan
    // supaya perilaku lamanya tidak berubah.
    dibacaPada: timestamp("dibaca_pada", { withTimezone: true }).notNull(),
    // Kapan barisnya pertama dibuat dan terakhir diperbarui, untuk menelusuri
    // jejak penandaan tanpa mengubah bentuk hasil layanan.
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Satu penanda per wali per murid per bagian; indeks inilah yang membuat
    // penandaan ulang idempoten lewat `ON CONFLICT ... DO UPDATE`.
    uniqueIndex("jejak_baca_portal_wali_murid_bagian_idx").on(
      table.waliId,
      table.muridId,
      table.bagian,
    ),
  ],
);
