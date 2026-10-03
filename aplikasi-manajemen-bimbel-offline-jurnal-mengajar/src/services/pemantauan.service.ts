import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  journalAttendances,
  schedules,
  students,
  teachingJournals,
  user,
} from "@/db/schema";
import type { NamaHari } from "@/lib/tanggal";
import type { ListJurnalHarianInput } from "@/validators/jurnal";

// Semua pembacaan lintas akun untuk pantauan owner. Fungsi di sini sengaja
// tidak menyaring pemilik baris, jadi hanya aman dipanggil dari endpoint yang
// dijaga `withApiPermission` (atau halaman dengan `requirePermission`).
// Akhiran "Any" menandai jangkauan itu.

const fieldsHarian = {
  id: teachingJournals.id,
  guruId: teachingJournals.guruId,
  guruNama: user.name,
  guruEmail: user.email,
  classId: teachingJournals.classId,
  namaKelas: classes.namaKelas,
  cabang: classes.cabang,
  hari: schedules.hari,
  jamMulai: sql<string | null>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
    "jam_mulai",
  ),
  jamSelesai: sql<
    string | null
  >`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as("jam_selesai"),
  tanggal: teachingJournals.tanggal,
  materi: teachingJournals.materi,
  catatan: teachingJournals.catatan,
  jamMengajar: teachingJournals.jamMengajar,
  status: teachingJournals.status,
  createdAt: teachingJournals.createdAt,
  jumlahMurid: sql<number>`count(${journalAttendances.id})::int`.as(
    "jumlah_murid",
  ),
  jumlahHadir:
    sql<number>`count(${journalAttendances.id}) filter (where ${journalAttendances.hadir})::int`.as(
      "jumlah_hadir",
    ),
};

// --- Lintas akun -----------------------------------------------------------
// Fungsi di bawah ini sengaja tidak menyaring pemilik baris, jadi hanya aman
// dipanggil dari endpoint yang dijaga `withApiPermission` (atau halaman dengan
// `requirePermission`). Akhiran "Any" menandai jangkauan itu.

/**
 * Jurnal semua guru pada satu tanggal, untuk pantauan owner. Diurutkan menurut
 * nama guru lalu jam mengajar supaya mudah dibaca dalam satu layar.
 */
export async function listAnyJurnal(filter: FilterPemantauan) {
  const syarat = [eq(teachingJournals.tanggal, filter.tanggal)];
  if (filter.classId) syarat.push(eq(teachingJournals.classId, filter.classId));
  if (filter.guruId) syarat.push(eq(teachingJournals.guruId, filter.guruId));
  if (filter.cabang) syarat.push(eq(classes.cabang, filter.cabang));

  const rows = await db
    .select(fieldsHarian)
    .from(teachingJournals)
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .innerJoin(user, eq(teachingJournals.guruId, user.id))
    .leftJoin(schedules, eq(teachingJournals.scheduleId, schedules.id))
    .leftJoin(
      journalAttendances,
      eq(journalAttendances.journalId, teachingJournals.id),
    )
    .where(and(...syarat))
    .groupBy(teachingJournals.id, classes.id, schedules.id, user.id)
    .orderBy(asc(user.name), asc(schedules.jamMulai), desc(teachingJournals.id))
    .limit(filter.limit + 1)
    .offset(filter.offset);

  return {
    data: rows.slice(0, filter.limit),
    meta: {
      tanggal: filter.tanggal,
      limit: filter.limit,
      offset: filter.offset,
      hasMore: rows.length > filter.limit,
    },
  };
}

export type JurnalHarian = Awaited<
  ReturnType<typeof listAnyJurnal>
>["data"][number];

/** Saringan pantauan owner: satu tanggal wajib, sisanya opsional. */
export type FilterPemantauan = Omit<ListJurnalHarianInput, "tanggal"> & {
  tanggal: string;
};

export type JadwalRingkas = {
  namaKelas: string;
  jamMulai: string;
  jamSelesai: string;
};

export type StatusGuruHariIni = {
  guruId: string;
  guruNama: string;
  guruEmail: string;
  jadwal: JadwalRingkas[];
  jumlahJurnal: number;
  totalJam: number;
  sudahMengisi: boolean;
};

/**
 * Status tiap guru pada satu hari: jadwal apa saja yang harus dia ajar, sudah
 * mengisi jurnal atau belum, dan berapa jam yang sudah tercatat. Gurunya
 * diambil dari jadwal hari itu ditambah siapa pun yang sudah mengirim jurnal
 * hari ini (mis. jadwalnya sudah dihapus), supaya tidak ada yang terlewat dari
 * pantauan. Yang belum mengisi tampil lebih dulu.
 */
export async function ringkasanAnyGuruHariIni(
  hari: NamaHari,
  filter: Omit<FilterPemantauan, "limit" | "offset">,
): Promise<StatusGuruHariIni[]> {
  const syaratJadwal = [eq(schedules.hari, hari)];
  if (filter.classId) syaratJadwal.push(eq(schedules.classId, filter.classId));
  if (filter.guruId) syaratJadwal.push(eq(schedules.guruId, filter.guruId));
  if (filter.cabang) syaratJadwal.push(eq(classes.cabang, filter.cabang));

  const barisJadwal = await db
    .select({
      guruId: schedules.guruId,
      guruNama: user.name,
      guruEmail: user.email,
      namaKelas: classes.namaKelas,
      jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
        "jam_mulai",
      ),
      jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
        "jam_selesai",
      ),
    })
    .from(schedules)
    .innerJoin(user, eq(schedules.guruId, user.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(and(...syaratJadwal))
    .orderBy(asc(schedules.jamMulai), asc(schedules.id));

  const syaratJurnal = [eq(teachingJournals.tanggal, filter.tanggal)];
  if (filter.classId)
    syaratJurnal.push(eq(teachingJournals.classId, filter.classId));
  if (filter.guruId)
    syaratJurnal.push(eq(teachingJournals.guruId, filter.guruId));
  if (filter.cabang) syaratJurnal.push(eq(classes.cabang, filter.cabang));

  const barisJurnal = await db
    .select({
      guruId: teachingJournals.guruId,
      guruNama: user.name,
      guruEmail: user.email,
      jumlahJurnal: sql<number>`count(*)::int`.as("jumlah_jurnal"),
      totalJam:
        sql<number>`coalesce(sum(${teachingJournals.jamMengajar}), 0)::float8`.as(
          "total_jam",
        ),
    })
    .from(teachingJournals)
    .innerJoin(user, eq(teachingJournals.guruId, user.id))
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .where(and(...syaratJurnal))
    .groupBy(teachingJournals.guruId, user.name, user.email);

  const perGuru = new Map<string, StatusGuruHariIni>();
  for (const baris of barisJadwal) {
    const guru = perGuru.get(baris.guruId) ?? {
      guruId: baris.guruId,
      guruNama: baris.guruNama,
      guruEmail: baris.guruEmail,
      jadwal: [],
      jumlahJurnal: 0,
      totalJam: 0,
      sudahMengisi: false,
    };
    guru.jadwal.push({
      namaKelas: baris.namaKelas,
      jamMulai: baris.jamMulai,
      jamSelesai: baris.jamSelesai,
    });
    perGuru.set(baris.guruId, guru);
  }
  for (const baris of barisJurnal) {
    const guru = perGuru.get(baris.guruId);
    perGuru.set(baris.guruId, {
      guruId: baris.guruId,
      guruNama: baris.guruNama,
      guruEmail: baris.guruEmail,
      jadwal: guru?.jadwal ?? [],
      jumlahJurnal: baris.jumlahJurnal,
      totalJam: baris.totalJam,
      sudahMengisi: true,
    });
  }

  return [...perGuru.values()].sort(
    (a, b) =>
      Number(a.sudahMengisi) - Number(b.sudahMengisi) ||
      a.guruNama.localeCompare(b.guruNama, "id"),
  );
}

/** Pilihan saringan pantauan: kelas, guru (role `user`), dan cabang. */
export async function opsiSaringPemantauan() {
  const daftarKelas = await db
    .select({
      classId: classes.id,
      namaKelas: classes.namaKelas,
      cabang: classes.cabang,
    })
    .from(classes)
    .orderBy(asc(classes.namaKelas), asc(classes.id));

  const daftarGuru = await db
    .select({ guruId: user.id, guruNama: user.name })
    .from(user)
    .where(sql`'user' = any(string_to_array(coalesce(${user.role}, ''), ','))`)
    .orderBy(asc(user.name));

  return {
    daftarKelas,
    daftarGuru,
    daftarCabang: [...new Set(daftarKelas.map((kelas) => kelas.cabang))].sort(
      (a, b) => a.localeCompare(b, "id"),
    ),
  };
}

export type KehadiranJurnal = {
  nama: string;
  hadir: boolean;
  catatan: string;
};

// --- Lintas akun (lanjutan) -------------------------------------------------

/**
 * Kehadiran murid untuk sekumpulan jurnal sekaligus, diurutkan menurut nama
 * murid. Dipanggil dengan id jurnal yang sudah didapat dari pembacaan yang
 * dijaga izin, jadi fungsi ini sendiri tidak menyaring pemilik baris.
 */
export async function listAnyKehadiranJurnal(
  jurnalIds: string[],
): Promise<(KehadiranJurnal & { journalId: string })[]> {
  if (jurnalIds.length === 0) return [];
  return db
    .select({
      journalId: journalAttendances.journalId,
      nama: students.nama,
      hadir: journalAttendances.hadir,
      catatan: journalAttendances.catatan,
    })
    .from(journalAttendances)
    .innerJoin(students, eq(journalAttendances.studentId, students.id))
    .where(inArray(journalAttendances.journalId, jurnalIds))
    .orderBy(asc(students.nama));
}

export type KelasKosong = {
  scheduleId: string;
  namaKelas: string;
  cabang: string;
  guruId: string;
  guruNama: string;
  jamMulai: string;
  jamSelesai: string;
};

/**
 * Jadwal hari ini yang jurnalnya belum dikirim. Dipakai owner sebagai
 * pemberitahuan "kelas kosong", dihitung dari jadwal yang tidak punya jurnal
 * pada tanggal itu.
 */
export async function kelasKosongHariIni(
  hari: NamaHari,
  filter: Omit<FilterPemantauan, "limit" | "offset">,
): Promise<KelasKosong[]> {
  const syarat = [eq(schedules.hari, hari)];
  if (filter.classId) syarat.push(eq(schedules.classId, filter.classId));
  if (filter.guruId) syarat.push(eq(schedules.guruId, filter.guruId));
  if (filter.cabang) syarat.push(eq(classes.cabang, filter.cabang));

  return db
    .select({
      scheduleId: schedules.id,
      namaKelas: classes.namaKelas,
      cabang: classes.cabang,
      guruId: schedules.guruId,
      guruNama: user.name,
      jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
        "jam_mulai",
      ),
      jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
        "jam_selesai",
      ),
    })
    .from(schedules)
    .innerJoin(user, eq(schedules.guruId, user.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .leftJoin(
      teachingJournals,
      and(
        eq(teachingJournals.scheduleId, schedules.id),
        eq(teachingJournals.tanggal, filter.tanggal),
      ),
    )
    .where(and(...syarat, isNull(teachingJournals.id)))
    .orderBy(asc(schedules.jamMulai), asc(schedules.id));
}

export type StatusPemantauan = {
  tanggal: string;
  hari: NamaHari;
  jumlahGuru: number;
  sudahMengisi: number;
  belumMengisi: number;
  jumlahJurnal: number;
  totalJam: number;
  kelasKosong: number;
  terakhirDiperbarui: string;
};

/**
 * Angka ringkas untuk pembaruan berkala di halaman owner: cukup untuk
 * menyegarkan penghitung tanpa memuat ulang seluruh daftar jurnal.
 */
export async function statusPemantauan(
  hari: NamaHari,
  filter: Omit<FilterPemantauan, "limit" | "offset">,
): Promise<StatusPemantauan> {
  const [jurnal, statusGuru, kelasKosong] = await Promise.all([
    listAnyJurnal({ ...filter, limit: 100, offset: 0 }),
    ringkasanAnyGuruHariIni(hari, filter),
    kelasKosongHariIni(hari, filter),
  ]);
  const sudahMengisi = statusGuru.filter((guru) => guru.sudahMengisi).length;

  return {
    tanggal: filter.tanggal,
    hari,
    jumlahGuru: statusGuru.length,
    sudahMengisi,
    belumMengisi: statusGuru.length - sudahMengisi,
    jumlahJurnal: jurnal.data.length,
    totalJam: jurnal.data.reduce(
      (jumlah, baris) => jumlah + baris.jamMengajar,
      0,
    ),
    kelasKosong: kelasKosong.length,
    terakhirDiperbarui: new Date().toISOString(),
  };
}
