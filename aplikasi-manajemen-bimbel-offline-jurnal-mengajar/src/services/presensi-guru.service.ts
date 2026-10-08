import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  classes,
  schedules,
  studentEnrollments,
  students,
  teacherAttendances,
  teachingJournals,
  user,
} from "@/db/schema";
import {
  hariDariTanggal,
  type PresensiGuru,
  type RekapKehadiranGuru,
  type RiwayatKehadiranGuru,
  type SesiPresensiGuru,
  type StatusPresensiGuru,
} from "@/lib/presensi-guru";
import { peranDariRole } from "@/lib/peran";
import { namaHari, tanggalISO } from "@/lib/tanggal";
import type {
  RekapPresensiGuruInput,
  SimpanPresensiGuruInput,
} from "@/validators/presensi-guru";

// Presensi kehadiran guru per sesi mengajar, sumbernya tabel
// `teacher_attendances` (migrasi 0017). Satu baris = satu guru + satu jadwal +
// satu tanggal, dijaga indeks unik, jadi mengirim ulang catatan yang sama
// memperbarui baris itu, bukan menambah baris kedua.
//
// Sesi mengajarnya sendiri berasal dari `schedules` milik guru yang sedang
// masuk: guru hanya pernah melihat dan mencatat sesinya sendiri, sedangkan
// owner/admin membaca rekap semua guru.

// Dua kolom menyimpan id akun (`guru_pengganti_id`, `diubah_oleh_id`), jadi
// tabel `user` di-join dua kali dengan alias supaya namanya tidak tertukar.
const pengganti = alias(user, "guru_pengganti");
const pengubah = alias(user, "pengubah_presensi");

// Kolom presensi diberi awalan supaya bisa digabung dengan kolom jadwal tanpa
// nama yang bertabrakan (mis. `jadwalId` dari jadwal vs dari presensi).
const kolomPresensi = {
  presensiId: teacherAttendances.id,
  presensiJadwalId: teacherAttendances.scheduleId,
  presensiTanggal: teacherAttendances.tanggal,
  presensiStatus: teacherAttendances.status,
  presensiGuruPenggantiId: teacherAttendances.guruPenggantiId,
  presensiGuruPenggantiNama: pengganti.name,
  presensiCatatan: teacherAttendances.catatan,
  presensiDiubahOlehNama: pengubah.name,
  presensiDiubahPada: teacherAttendances.updatedAt,
};

// Bentuk baris hasil join. Kolom presensi bisa `null` karena `leftJoin`.
type BarisPresensi = {
  presensiId: string | null;
  presensiJadwalId: string | null;
  presensiTanggal: string | null;
  presensiStatus: StatusPresensiGuru | null;
  presensiGuruPenggantiId: string | null;
  presensiGuruPenggantiNama: string | null;
  presensiCatatan: string | null;
  presensiDiubahOlehNama: string | null;
  presensiDiubahPada: Date | null;
};

/**
 * Baris presensi dari join (`leftJoin` membuat kolomnya bisa `null`) menjadi
 * bentuk yang dikirim ke tampilan. `null` berarti sesi itu belum pernah
 * ditandai, jadi pemanggil tidak perlu memeriksa kolomnya satu per satu.
 */
function bentukPresensi(baris: BarisPresensi): PresensiGuru | null {
  if (
    !baris.presensiId ||
    !baris.presensiJadwalId ||
    !baris.presensiTanggal ||
    !baris.presensiStatus ||
    !baris.presensiDiubahPada
  )
    return null;

  return {
    id: baris.presensiId,
    jadwalId: baris.presensiJadwalId,
    tanggal: baris.presensiTanggal,
    status: baris.presensiStatus,
    guruPenggantiId: baris.presensiGuruPenggantiId,
    guruPenggantiNama: baris.presensiGuruPenggantiNama,
    catatan: baris.presensiCatatan ?? "",
    diubahOlehNama: baris.presensiDiubahOlehNama,
    diubahPada: baris.presensiDiubahPada.toISOString(),
  };
}

/** Murid yang masih aktif di tiap kelas, diurutkan nama. */
async function muridPerKelas(kelasIds: string[]) {
  if (kelasIds.length === 0)
    return new Map<string, { id: string; nama: string }[]>();

  const baris = await db
    .select({
      kelasId: studentEnrollments.classId,
      id: students.id,
      nama: students.nama,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .where(
      and(
        inArray(studentEnrollments.classId, kelasIds),
        eq(studentEnrollments.status, "aktif"),
      ),
    )
    .orderBy(asc(students.nama));

  const perKelas = new Map<string, { id: string; nama: string }[]>();
  for (const murid of baris) {
    perKelas.set(murid.kelasId, [
      ...(perKelas.get(murid.kelasId) ?? []),
      { id: murid.id, nama: murid.nama },
    ]);
  }
  return perKelas;
}

// Jam dikirim sebagai "07:00" supaya tampilan tidak perlu memotong detik.
const kolomSesi = {
  jadwalId: schedules.id,
  classId: schedules.classId,
  namaKelas: classes.namaKelas,
  cabang: classes.cabang,
  jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
    "jam_mulai",
  ),
  jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
    "jam_selesai",
  ),
  ...kolomPresensi,
};

/**
 * Sesi mengajar satu guru pada satu tanggal, lengkap dengan presensinya
 * (`null` = belum ditandai) dan murid aktif kelasnya. `jadwalId` dipakai
 * halaman satu sesi; tanpa itu seluruh sesi hari itu dikembalikan.
 */
async function ambilSesi(
  guruId: string,
  tanggal: string,
  jadwalId?: string,
): Promise<SesiPresensiGuru[]> {
  const baris = await db
    .select(kolomSesi)
    .from(schedules)
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .leftJoin(
      teacherAttendances,
      and(
        eq(teacherAttendances.scheduleId, schedules.id),
        eq(teacherAttendances.guruId, schedules.guruId),
        eq(teacherAttendances.tanggal, tanggal),
      ),
    )
    .leftJoin(pengganti, eq(teacherAttendances.guruPenggantiId, pengganti.id))
    .leftJoin(pengubah, eq(teacherAttendances.diubahOlehId, pengubah.id))
    .where(
      and(
        eq(schedules.guruId, guruId),
        eq(schedules.hari, hariDariTanggal(tanggal)),
        jadwalId ? eq(schedules.id, jadwalId) : undefined,
      ),
    )
    .orderBy(asc(schedules.jamMulai), asc(schedules.id));

  const murid = await muridPerKelas([
    ...new Set(baris.map((sesi) => sesi.classId)),
  ]);

  return baris.map((sesi) => ({
    jadwalId: sesi.jadwalId,
    classId: sesi.classId,
    namaKelas: sesi.namaKelas,
    cabang: sesi.cabang,
    jamMulai: sesi.jamMulai,
    jamSelesai: sesi.jamSelesai,
    murid: murid.get(sesi.classId) ?? [],
    presensi: bentukPresensi(sesi),
  }));
}

/** Sesi mengajar guru pada satu tanggal (`YYYY-MM-DD`), terurut jam mulai. */
export function listSesiPresensiGuru(guruId: string, tanggal: string) {
  return ambilSesi(guruId, tanggal);
}

/** Satu sesi guru pada satu tanggal, atau `null` kalau bukan sesinya. */
export async function getSesiPresensiGuru(
  guruId: string,
  jadwalId: string,
  tanggal: string,
): Promise<SesiPresensiGuru | null> {
  const [sesi] = await ambilSesi(guruId, tanggal, jadwalId);
  return sesi ?? null;
}

/** Id jurnal sesi ini kalau jurnalnya sudah diisi, untuk tautan silang. */
export async function getJurnalIdSesi(
  guruId: string,
  jadwalId: string,
  tanggal: string,
): Promise<string | null> {
  const [jurnal] = await db
    .select({ id: teachingJournals.id })
    .from(teachingJournals)
    .where(
      and(
        eq(teachingJournals.guruId, guruId),
        eq(teachingJournals.scheduleId, jadwalId),
        eq(teachingJournals.tanggal, tanggal),
      ),
    )
    .limit(1);
  return jurnal?.id ?? null;
}

export type HasilSimpanPresensi =
  | { status: "tersimpan"; presensi: PresensiGuru; baru: boolean }
  | { status: "jadwal_tidak_ada" }
  | { status: "bukan_hari_ini" }
  | { status: "pengganti_tidak_ada" }
  | { status: "pengganti_bukan_guru" };

/**
 * Menyimpan (atau mengganti) presensi guru untuk satu sesi hari ini.
 *
 * Idempoten: kunci barisnya (guru, jadwal, tanggal) dipegang indeks unik, jadi
 * mengirim catatan yang sama dua kali hanya memperbarui baris pertama —
 * jumlahnya tetap satu. Jadwal milik guru lain dilaporkan `jadwal_tidak_ada`
 * supaya endpoint-nya bisa menjawab 404, bukan 403 dengan pesan berbeda.
 */
export async function simpanPresensiGuru(
  guruId: string,
  input: SimpanPresensiGuruInput,
): Promise<HasilSimpanPresensi> {
  const sekarang = new Date();
  const tanggal = tanggalISO(sekarang);

  // Kepemilikan sesi selalu dibaca dari jadwal milik guru ini.
  const [jadwal] = await db
    .select({ id: schedules.id, hari: schedules.hari })
    .from(schedules)
    .where(and(eq(schedules.id, input.jadwalId), eq(schedules.guruId, guruId)))
    .limit(1);
  if (!jadwal) return { status: "jadwal_tidak_ada" };
  if (jadwal.hari !== namaHari(sekarang)) return { status: "bukan_hari_ini" };

  if (input.guruPenggantiId) {
    const [calon] = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, input.guruPenggantiId))
      .limit(1);
    if (!calon) return { status: "pengganti_tidak_ada" };
    // Pengganti harus akun bimbel; akun wali tidak boleh tercatat menggantikan
    // sesi mengajar karena namanya ikut muncul di laporan presensi.
    if (peranDariRole(calon.role) === "orang-tua")
      return { status: "pengganti_bukan_guru" };
  }

  const [sudahAda] = await db
    .select({ id: teacherAttendances.id })
    .from(teacherAttendances)
    .where(
      and(
        eq(teacherAttendances.guruId, guruId),
        eq(teacherAttendances.scheduleId, jadwal.id),
        eq(teacherAttendances.tanggal, tanggal),
      ),
    )
    .limit(1);

  const nilai = {
    status: input.status,
    catatan: input.catatan.trim() ? input.catatan.trim() : null,
    guruPenggantiId:
      input.status === "digantikan" ? (input.guruPenggantiId ?? null) : null,
    diubahOlehId: guruId,
    updatedAt: sekarang,
  };

  const [baris] = await db
    .insert(teacherAttendances)
    .values({ guruId, scheduleId: jadwal.id, tanggal, ...nilai })
    .onConflictDoUpdate({
      target: [
        teacherAttendances.guruId,
        teacherAttendances.scheduleId,
        teacherAttendances.tanggal,
      ],
      set: nilai,
    })
    .returning({ id: teacherAttendances.id });

  const presensi = await getPresensiGuru(baris.id);
  if (!presensi)
    throw new Error("Presensi yang baru disimpan tidak ditemukan.");
  return { status: "tersimpan", presensi, baru: !sudahAda };
}

/** Satu baris presensi menurut id, atau `null` kalau id-nya tidak ada. */
export async function getPresensiGuru(
  id: string,
): Promise<PresensiGuru | null> {
  const [baris] = await db
    .select(kolomPresensi)
    .from(teacherAttendances)
    .innerJoin(schedules, eq(teacherAttendances.scheduleId, schedules.id))
    .leftJoin(pengganti, eq(teacherAttendances.guruPenggantiId, pengganti.id))
    .leftJoin(pengubah, eq(teacherAttendances.diubahOlehId, pengubah.id))
    .where(eq(teacherAttendances.id, id))
    .limit(1);
  return baris ? bentukPresensi(baris) : null;
}

/**
 * Menghapus satu catatan presensi ("batalkan tanda kehadiran"). Hanya pemilik
 * barisnya, yaitu gurunya sendiri, yang bisa menghapus; owner/admin membaca
 * saja, jadi baris orang lain jawabannya sama seperti baris yang tidak ada.
 */
export async function hapusPresensiGuru(
  guruId: string,
  presensiId: string,
): Promise<boolean> {
  const dihapus = await db
    .delete(teacherAttendances)
    .where(
      and(
        eq(teacherAttendances.id, presensiId),
        eq(teacherAttendances.guruId, guruId),
      ),
    )
    .returning({ id: teacherAttendances.id });
  return dihapus.length > 0;
}

/** Penyaring rekap: satu guru (kalau diminta) dan rentang tanggal. */
function syaratRiwayat({ guruId, dari, sampai }: RekapPresensiGuruInput) {
  return and(
    guruId ? eq(teacherAttendances.guruId, guruId) : undefined,
    dari ? gte(teacherAttendances.tanggal, dari) : undefined,
    sampai ? lte(teacherAttendances.tanggal, sampai) : undefined,
  );
}

const kolomRiwayat = {
  id: teacherAttendances.id,
  jadwalId: teacherAttendances.scheduleId,
  tanggal: teacherAttendances.tanggal,
  namaKelas: classes.namaKelas,
  cabang: classes.cabang,
  jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
    "jam_mulai",
  ),
  jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
    "jam_selesai",
  ),
  guruId: teacherAttendances.guruId,
  guruNama: user.name,
  status: teacherAttendances.status,
  guruPenggantiNama: pengganti.name,
  catatan: teacherAttendances.catatan,
  diubahOlehNama: pengubah.name,
  diubahPada: teacherAttendances.updatedAt,
};

/** Batas baris rekap yang ditampilkan; jumlah di `meta` tetap dihitung penuh. */
const BATAS_RIWAYAT = 100;

export type DaftarRiwayatKehadiranGuru = {
  data: RiwayatKehadiranGuru[];
  meta: RekapKehadiranGuru & { limit: number };
};

/**
 * Rekap kehadiran guru, terbaru lebih dulu. Jumlah tiap status di `meta`
 * dihitung dari seluruh baris yang cocok penyaring — bukan hanya baris yang
 * dikirim — jadi tampilan bisa menulis "40 catatan" tanpa mengambil semuanya.
 */
export async function listRiwayatKehadiranGuru(
  filter: RekapPresensiGuruInput = {},
): Promise<DaftarRiwayatKehadiranGuru> {
  const syarat = syaratRiwayat(filter);

  const baris = await db
    .select(kolomRiwayat)
    .from(teacherAttendances)
    .innerJoin(schedules, eq(teacherAttendances.scheduleId, schedules.id))
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .innerJoin(user, eq(teacherAttendances.guruId, user.id))
    .leftJoin(pengganti, eq(teacherAttendances.guruPenggantiId, pengganti.id))
    .leftJoin(pengubah, eq(teacherAttendances.diubahOlehId, pengubah.id))
    .where(syarat)
    .orderBy(
      desc(teacherAttendances.tanggal),
      desc(schedules.jamMulai),
      desc(teacherAttendances.id),
    )
    .limit(BATAS_RIWAYAT);

  const [jumlah] = await db
    .select({
      total: sql<number>`count(*)::int`.as("total"),
      hadir:
        sql<number>`count(*) filter (where ${teacherAttendances.status} = 'hadir')::int`.as(
          "hadir",
        ),
      izin: sql<number>`count(*) filter (where ${teacherAttendances.status} = 'izin')::int`.as(
        "izin",
      ),
      tidakHadir:
        sql<number>`count(*) filter (where ${teacherAttendances.status} = 'tidak_hadir')::int`.as(
          "tidak_hadir",
        ),
      digantikan:
        sql<number>`count(*) filter (where ${teacherAttendances.status} = 'digantikan')::int`.as(
          "digantikan",
        ),
    })
    .from(teacherAttendances)
    .where(syarat);

  return {
    data: baris.map((baris) => ({
      ...baris,
      catatan: baris.catatan ?? "",
      diubahPada: baris.diubahPada.toISOString(),
    })),
    meta: {
      limit: BATAS_RIWAYAT,
      total: jumlah?.total ?? 0,
      hadir: jumlah?.hadir ?? 0,
      izin: jumlah?.izin ?? 0,
      tidakHadir: jumlah?.tidakHadir ?? 0,
      digantikan: jumlah?.digantikan ?? 0,
    },
  };
}
