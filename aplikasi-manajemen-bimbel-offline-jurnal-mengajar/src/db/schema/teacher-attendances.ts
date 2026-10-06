import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { schedules } from "./schedules";
import { user } from "./user";

// hadir = guru mengisi sesi, izin = sudah memberi kabar, tidak_hadir = sesi
// tidak diisi tanpa kabar, digantikan = sesi diisi guru lain (lihat
// `guru_pengganti_id`).
export const statusKehadiranGuru = pgEnum("status_kehadiran_guru", [
  "hadir",
  "izin",
  "tidak_hadir",
  "digantikan",
]);

// Presensi kehadiran guru per sesi mengajar. Satu sesi (guru + jadwal +
// tanggal) hanya punya satu catatan yang boleh diperbarui — penjaganya indeks
// unik, jadi pengiriman ulang tidak pernah membuat baris ganda. Kolom
// `diubah_oleh_id` menyimpan siapa yang terakhir mengubah statusnya.
export const teacherAttendances = pgTable(
  "teacher_attendances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    guruId: text("guru_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    tanggal: date("tanggal").notNull(),
    status: statusKehadiranGuru("status").default("hadir").notNull(),
    // Diisi hanya kalau statusnya "digantikan".
    guruPenggantiId: text("guru_pengganti_id").references(() => user.id, {
      onDelete: "set null",
    }),
    catatan: text("catatan"),
    diubahOlehId: text("diubah_oleh_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Satu catatan per guru per jadwal per tanggal (idempoten).
    uniqueIndex("teacher_attendances_guru_jadwal_tanggal_idx").on(
      table.guruId,
      table.scheduleId,
      table.tanggal,
    ),
    // Dipakai daftar presensi harian dan rekap per periode.
    index("teacher_attendances_tanggal_idx").on(table.tanggal),
  ],
);
