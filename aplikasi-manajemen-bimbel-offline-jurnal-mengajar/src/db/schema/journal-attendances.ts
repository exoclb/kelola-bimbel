import {
  boolean,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { students } from "./students";
import { teachingJournals } from "./teaching-journals";

// Kehadiran satu murid pada satu jurnal. Satu jurnal tidak boleh mencatat
// murid yang sama dua kali.
export const journalAttendances = pgTable(
  "journal_attendances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalId: uuid("journal_id")
      .notNull()
      .references(() => teachingJournals.id, { onDelete: "cascade" }),
    // Murid dinonaktifkan lewat `status_aktif`, jadi baris kehadiran tidak
    // pernah ikut terhapus saat datanya dirapikan.
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    hadir: boolean("hadir").default(true).notNull(),
    catatan: varchar("catatan", { length: 200 }).default("").notNull(),
  },
  (table) => [
    uniqueIndex("journal_attendances_journal_student_idx").on(
      table.journalId,
      table.studentId,
    ),
  ],
);
