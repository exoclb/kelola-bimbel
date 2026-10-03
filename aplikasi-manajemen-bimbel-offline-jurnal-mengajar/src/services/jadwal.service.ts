import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classes, schedules } from "@/db/schema";
import type { NamaHari } from "@/lib/tanggal";

// Jam dikirim sebagai "07:00" supaya tampilan tidak perlu memotong detik.
const fields = {
  id: schedules.id,
  classId: schedules.classId,
  namaKelas: classes.namaKelas,
  cabang: classes.cabang,
  jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
    "jam_mulai",
  ),
  jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
    "jam_selesai",
  ),
};

/**
 * Jadwal mengajar milik satu guru pada satu hari. `guruId` datang dari sesi
 * yang sudah diverifikasi, jadi guru tidak pernah melihat jadwal guru lain.
 */
export async function listJadwalGuruHariIni(guruId: string, hari: NamaHari) {
  return db
    .select(fields)
    .from(schedules)
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(and(eq(schedules.guruId, guruId), eq(schedules.hari, hari)))
    .orderBy(asc(schedules.jamMulai), asc(schedules.id));
}
