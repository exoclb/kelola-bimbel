import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { classes } from "./classes";
import { schedules } from "./schedules";
import { user } from "./user";

// 'terkirim' = baru dikirim guru, 'direview' = sudah dibaca owner.
export const statusJurnal = pgEnum("status_jurnal", ["terkirim", "direview"]);

// Jurnal mengajar harian. `jam_mengajar` diambil dari jadwal saat jurnal
// dibuat dan menjadi dasar hitung gaji, jadi barisnya tidak boleh dobel untuk
// kelas + jadwal + tanggal yang sama.
export const teachingJournals = pgTable(
  "teaching_journals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guruId: text("guru_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    // Jadwal boleh berubah atau dihapus; jurnalnya tetap tersimpan.
    scheduleId: uuid("schedule_id").references(() => schedules.id, {
      onDelete: "set null",
    }),
    tanggal: date("tanggal").notNull(),
    materi: varchar("materi", { length: 200 }).notNull(),
    catatan: text("catatan").default("").notNull(),
    jamMengajar: numeric("jam_mengajar", {
      precision: 4,
      scale: 2,
      mode: "number",
    }).notNull(),
    status: statusJurnal("status").default("terkirim").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Satu guru hanya boleh punya satu jurnal per jadwal per tanggal, supaya
    // kirim ulang (dobel klik / ulang setelah koneksi putus) tidak dihitung
    // dua kali saat rekap gaji.
    uniqueIndex("teaching_journals_guru_jadwal_tanggal_idx").on(
      table.guruId,
      table.scheduleId,
      table.tanggal,
    ),
    index("teaching_journals_guru_tanggal_idx").on(
      table.guruId,
      table.tanggal.desc(),
    ),
    index("teaching_journals_class_tanggal_idx").on(
      table.classId,
      table.tanggal.desc(),
    ),
    // Isian yang tidak bisa ditampilkan tidak boleh masuk: materi kosong
    // membuat baris jurnal tak terbaca, dan jam mengajar nol/negatif membuat
    // rekap gaji salah hitung tanpa jejak. Keduanya sudah dijaga validator;
    // di sini dijaga ulang supaya penulisan langsung ke basis data pun aman.
    check(
      "teaching_journals_materi_terisi",
      sql`length(btrim(${table.materi})) > 0`,
    ),
    check(
      "teaching_journals_jam_mengajar_positif",
      sql`${table.jamMengajar} > 0`,
    ),
  ],
);
