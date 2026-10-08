import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  journalAttendances,
  students,
  teachingJournals,
  user,
} from "@/db/schema";
import type { ListKehadiranInput } from "@/validators/kehadiran";

/** Satu baris kehadiran seperti yang dikirim ke klien. */
export type KehadiranTersimpan = {
  jurnalId: string;
  muridId: string;
  muridNama: string;
  kelasId: string;
  kelasNama: string;
  guruNama: string;
  tanggal: string;
  hadir: boolean;
  catatan: string;
};

export type DaftarKehadiran = {
  data: KehadiranTersimpan[];
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
    total: number;
    hadir: number;
    tidakHadir: number;
  };
};

// Kehadiran tidak punya tanggal sendiri: tanggalnya ikut jurnal harinya.
const fields = {
  jurnalId: journalAttendances.journalId,
  muridId: journalAttendances.studentId,
  muridNama: students.nama,
  kelasId: teachingJournals.classId,
  kelasNama: classes.namaKelas,
  guruNama: user.name,
  tanggal: teachingJournals.tanggal,
  hadir: journalAttendances.hadir,
  catatan: journalAttendances.catatan,
};

function syaratKehadiran({
  muridId,
  kelasId,
  dari,
  sampai,
}: ListKehadiranInput) {
  return and(
    muridId ? eq(journalAttendances.studentId, muridId) : undefined,
    kelasId ? eq(teachingJournals.classId, kelasId) : undefined,
    dari ? gte(teachingJournals.tanggal, dari) : undefined,
    sampai ? lte(teachingJournals.tanggal, sampai) : undefined,
  );
}

/**
 * Kehadiran murid dari jurnal-jurnal yang sudah diisi guru, terbaru lebih
 * dulu. `muridId` dipakai untuk laporan satu anak ke orang tuanya, `kelasId`
 * dan rentang tanggal untuk memeriksa satu kelas atau satu periode.
 *
 * `meta.hadir`/`meta.tidakHadir` dihitung dari seluruh baris yang cocok
 * penyaring (bukan hanya halaman yang dikirim), jadi tampilan bisa menulis
 * "12 dari 14 pertemuan" tanpa mengambil semua halaman.
 */
export async function listKehadiran(
  filter: ListKehadiranInput,
): Promise<DaftarKehadiran> {
  const { limit, offset } = filter;
  const syarat = syaratKehadiran(filter);

  const rows = await db
    .select(fields)
    .from(journalAttendances)
    .innerJoin(
      teachingJournals,
      eq(journalAttendances.journalId, teachingJournals.id),
    )
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .innerJoin(students, eq(journalAttendances.studentId, students.id))
    .innerJoin(user, eq(teachingJournals.guruId, user.id))
    .where(syarat)
    .orderBy(
      desc(teachingJournals.tanggal),
      asc(students.nama),
      asc(journalAttendances.id),
    )
    .limit(limit + 1)
    .offset(offset);

  const [jumlah] = await db
    .select({
      total: sql<number>`count(*)::int`.as("total"),
      hadir:
        sql<number>`count(*) filter (where ${journalAttendances.hadir})::int`.as(
          "hadir",
        ),
    })
    .from(journalAttendances)
    .innerJoin(
      teachingJournals,
      eq(journalAttendances.journalId, teachingJournals.id),
    )
    .where(syarat);

  const hadir = jumlah?.hadir ?? 0;
  const total = jumlah?.total ?? 0;

  return {
    data: rows.slice(0, limit),
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      total,
      hadir,
      tidakHadir: total - hadir,
    },
  };
}

/**
 * Seluruh kehadiran beberapa anak sekaligus, terbaru lebih dulu — dipakai
 * Portal Wali supaya semua sesi anak yang tertaut ke satu akun wali terbaca
 * dalam satu permintaan, bukan satu query per anak. Daftar id kosong
 * menghasilkan daftar kosong tanpa menyentuh basis data.
 */
export async function listKehadiranAnak(
  muridIds: string[],
): Promise<KehadiranTersimpan[]> {
  if (muridIds.length === 0) return [];
  return db
    .select(fields)
    .from(journalAttendances)
    .innerJoin(
      teachingJournals,
      eq(journalAttendances.journalId, teachingJournals.id),
    )
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .innerJoin(students, eq(journalAttendances.studentId, students.id))
    .innerJoin(user, eq(teachingJournals.guruId, user.id))
    .where(inArray(journalAttendances.studentId, muridIds))
    .orderBy(
      desc(teachingJournals.tanggal),
      asc(students.nama),
      asc(journalAttendances.id),
    );
}

/** Jumlah pertemuan dan kehadiran satu murid, dipakai laporan agregat. */
export type RingkasanKehadiranMurid = {
  muridId: string;
  pertemuan: number;
  hadir: number;
};

/**
 * Menghitung pertemuan dan kehadiran per murid dengan penyaring yang sama
 * seperti `listKehadiran`. Hanya murid yang punya baris kehadiran yang muncul,
 * jadi laporan bisa membedakan "belum pernah hadir" dari "tidak dihitung".
 */
export async function ringkasanKehadiranPerMurid(
  filter: ListKehadiranInput,
): Promise<RingkasanKehadiranMurid[]> {
  const baris = await db
    .select({
      muridId: journalAttendances.studentId,
      pertemuan: sql<number>`count(*)::int`.as("pertemuan"),
      hadir:
        sql<number>`count(*) filter (where ${journalAttendances.hadir})::int`.as(
          "hadir",
        ),
    })
    .from(journalAttendances)
    .innerJoin(
      teachingJournals,
      eq(journalAttendances.journalId, teachingJournals.id),
    )
    .where(syaratKehadiran(filter))
    .groupBy(journalAttendances.studentId);

  return baris;
}
