import { sql } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { classes } from "./classes";
import { students } from "./students";

// 'aktif' = murid sedang belajar di kelas itu, 'selesai' = sudah keluar atau
// pindah kelas. Riwayatnya disimpan, bukan dihapus.
export const statusPenempatan = pgEnum("status_penempatan", [
  "aktif",
  "selesai",
]);

// Penempatan murid ke kelas. Murid boleh punya banyak baris (riwayat), dan
// boleh aktif di beberapa kelas sekaligus (mis. kelas matematika dan kelas
// bahasa). Yang dijaga adalah pasangannya: satu murid hanya boleh punya satu
// penempatan aktif per kelas, supaya kehadirannya tidak terhitung dua kali di
// kelas yang sama.
export const studentEnrollments = pgTable(
  "student_enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    tanggalMulai: date("tanggal_mulai").notNull(),
    status: statusPenempatan("status").default("aktif").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("student_enrollments_student_kelas_aktif_idx")
      .on(table.studentId, table.classId)
      .where(sql`${table.status} = 'aktif'`),
    index("student_enrollments_class_status_idx").on(
      table.classId,
      table.status,
    ),
  ],
);
