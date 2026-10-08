import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { students } from "./students";
import { user } from "./user";

// Catatan perkembangan anak: nilai, sikap, dan catatan naratif dari guru.
// Boleh lebih dari satu catatan pada hari yang sama karena guru bisa mencatat
// beberapa hal sekaligus, dan catatannya bisa diperbaiki (diedit) kemudian.
export const studentProgress = pgTable(
  "student_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    guruId: text("guru_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tanggal: date("tanggal").notNull(),
    nilai: numeric("nilai", {
      precision: 5,
      scale: 2,
      mode: "number",
    }).notNull(),
    // Sikap anak saat belajar; pilihan cepatnya diatur di tampilan (text, bukan
    // enum, supaya guru bisa memakai kata lain tanpa migrasi).
    sikap: text("sikap").notNull(),
    catatanPerkembangan: text("catatan_perkembangan").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Riwayat perkembangan per anak, terbaru lebih dulu.
    index("student_progress_student_tanggal_idx").on(
      table.studentId,
      table.tanggal,
    ),
    index("student_progress_guru_idx").on(table.guruId),
    // Nilai anak selalu 0–100; dijaga database supaya impor atau perbaikan
    // manual tidak bisa menyisipkan angka di luar rentang itu.
    check(
      "student_progress_nilai_rentang",
      sql`${table.nilai} >= 0 and ${table.nilai} <= 100`,
    ),
  ],
);
