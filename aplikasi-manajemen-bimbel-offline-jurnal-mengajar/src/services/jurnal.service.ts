import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  journalAttendances,
  schedules,
  students,
  teachingJournals,
} from "@/db/schema";
import { tanggalISO } from "@/lib/tanggal";
import type { SimpanJurnalInput } from "@/validators/jurnal";

export type HasilSimpanJurnal =
  | { status: "tersimpan"; jurnal: JurnalTersimpan }
  | { status: "jadwal_tidak_ada" }
  | { status: "jadwal_tidak_valid" }
  | { status: "murid_tidak_ada"; muridIds: string[] };

export type JurnalTersimpan = {
  id: string;
  classId: string;
  scheduleId: string | null;
  tanggal: string;
  materi: string;
  catatan: string;
  jamMengajar: number;
  status: "terkirim" | "direview";
  kehadiran: { muridId: string; hadir: boolean; catatan: string }[];
};

const fields = {
  id: teachingJournals.id,
  classId: teachingJournals.classId,
  scheduleId: teachingJournals.scheduleId,
  tanggal: teachingJournals.tanggal,
  materi: teachingJournals.materi,
  catatan: teachingJournals.catatan,
  jamMengajar: teachingJournals.jamMengajar,
  status: teachingJournals.status,
};

/**
 * Menyimpan jurnal mengajar guru untuk satu jadwal pada hari ini.
 *
 * Idempoten: kirim ulang untuk jadwal + tanggal yang sama akan memperbarui
 * baris yang sudah ada (bukan membuat baris kedua), sehingga jam mengajar
 * tidak pernah terhitung dua kali saat rekap gaji. Kelas, tanggal, dan jam
 * mengajar selalu diambil dari jadwal milik guru yang sedang masuk.
 */
export async function simpanJurnal(
  guruId: string,
  input: SimpanJurnalInput,
): Promise<HasilSimpanJurnal> {
  const [jadwal] = await db
    .select({
      id: schedules.id,
      classId: schedules.classId,
      jamMengajar: sql<number>`round(extract(epoch from (${schedules.jamSelesai} - ${schedules.jamMulai})) / 3600, 2)::float8`,
    })
    .from(schedules)
    .where(and(eq(schedules.id, input.jadwalId), eq(schedules.guruId, guruId)))
    .limit(1);
  if (!jadwal) return { status: "jadwal_tidak_ada" };
  if (!(jadwal.jamMengajar > 0)) return { status: "jadwal_tidak_valid" };

  const muridIds = input.kehadiran.map((baris) => baris.muridId);
  if (muridIds.length > 0) {
    const dikenal = await db
      .select({ id: students.id })
      .from(students)
      .where(inArray(students.id, muridIds));
    const ketemu = new Set(dikenal.map((murid) => murid.id));
    const tidakDikenal = muridIds.filter((id) => !ketemu.has(id));
    if (tidakDikenal.length > 0)
      return { status: "murid_tidak_ada", muridIds: tidakDikenal };
  }

  const tanggal = tanggalISO(new Date());

  return db.transaction(async (tx) => {
    const [jurnal] = await tx
      .insert(teachingJournals)
      .values({
        guruId,
        classId: jadwal.classId,
        scheduleId: jadwal.id,
        tanggal,
        materi: input.materi,
        catatan: input.catatan,
        jamMengajar: jadwal.jamMengajar,
        status: "terkirim",
      })
      .onConflictDoUpdate({
        target: [
          teachingJournals.guruId,
          teachingJournals.scheduleId,
          teachingJournals.tanggal,
        ],
        set: {
          materi: input.materi,
          catatan: input.catatan,
          jamMengajar: jadwal.jamMengajar,
          // Isinya berubah, jadi owner perlu meninjau ulang.
          status: "terkirim",
          updatedAt: new Date(),
        },
      })
      .returning(fields);

    await tx
      .delete(journalAttendances)
      .where(eq(journalAttendances.journalId, jurnal.id));

    if (input.kehadiran.length > 0) {
      await tx.insert(journalAttendances).values(
        input.kehadiran.map((baris) => ({
          journalId: jurnal.id,
          studentId: baris.muridId,
          hadir: baris.hadir,
          catatan: baris.catatan,
        })),
      );
    }

    const kehadiran = await tx
      .select({
        muridId: journalAttendances.studentId,
        hadir: journalAttendances.hadir,
        catatan: journalAttendances.catatan,
      })
      .from(journalAttendances)
      .innerJoin(students, eq(journalAttendances.studentId, students.id))
      .where(eq(journalAttendances.journalId, jurnal.id))
      .orderBy(asc(students.nama));

    return { status: "tersimpan", jurnal: { ...jurnal, kehadiran } };
  });
}
