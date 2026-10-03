import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  journalAttendances,
  schedules,
  students,
  teachingJournals,
  user,
} from "@/db/schema";
import { tanggalISO } from "@/lib/tanggal";
import type { NamaHari } from "@/lib/tanggal";
import type {
  KoreksiJurnalInput,
  ListJurnalHarianInput,
  ListJurnalInput,
  SimpanJurnalInput,
} from "@/validators/jurnal";

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

const fieldsRiwayat = {
  id: teachingJournals.id,
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
  jumlahMurid: sql<number>`count(${journalAttendances.id})::int`.as(
    "jumlah_murid",
  ),
  jumlahHadir:
    sql<number>`count(${journalAttendances.id}) filter (where ${journalAttendances.hadir})::int`.as(
      "jumlah_hadir",
    ),
};

export type JurnalRiwayatGuru = Awaited<
  ReturnType<typeof listJurnalGuru>
>["data"][number];

/**
 * Riwayat jurnal satu guru, terbaru lebih dulu, dengan saringan kelas dan
 * rentang tanggal. `meta.kelas` berisi daftar kelas yang pernah diisi guru ini
 * supaya tampilan bisa menyusun pilihan saringan tanpa endpoint terpisah.
 */
export async function listJurnalGuru(guruId: string, filter: ListJurnalInput) {
  const syarat = [eq(teachingJournals.guruId, guruId)];
  if (filter.classId) syarat.push(eq(teachingJournals.classId, filter.classId));
  if (filter.dari) syarat.push(gte(teachingJournals.tanggal, filter.dari));
  if (filter.sampai) syarat.push(lte(teachingJournals.tanggal, filter.sampai));

  const rows = await db
    .select(fieldsRiwayat)
    .from(teachingJournals)
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .leftJoin(schedules, eq(teachingJournals.scheduleId, schedules.id))
    .leftJoin(
      journalAttendances,
      eq(journalAttendances.journalId, teachingJournals.id),
    )
    .where(and(...syarat))
    .groupBy(teachingJournals.id, classes.id, schedules.id)
    .orderBy(
      desc(teachingJournals.tanggal),
      desc(teachingJournals.createdAt),
      desc(teachingJournals.id),
    )
    .limit(filter.limit + 1)
    .offset(filter.offset);

  const kelas = await db
    .selectDistinct({
      classId: teachingJournals.classId,
      namaKelas: classes.namaKelas,
    })
    .from(teachingJournals)
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .where(eq(teachingJournals.guruId, guruId))
    .orderBy(asc(classes.namaKelas));

  return {
    data: rows.slice(0, filter.limit),
    meta: {
      limit: filter.limit,
      offset: filter.offset,
      hasMore: rows.length > filter.limit,
      kelas,
    },
  };
}

const fieldsDetail = {
  id: teachingJournals.id,
  classId: teachingJournals.classId,
  namaKelas: classes.namaKelas,
  cabang: classes.cabang,
  scheduleId: teachingJournals.scheduleId,
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
  updatedAt: teachingJournals.updatedAt,
};

/**
 * Satu jurnal milik guru ini lengkap dengan daftar muridnya. Mengembalikan
 * `null` untuk jurnal yang tidak ada maupun yang bukan milik guru ini, supaya
 * keduanya tidak bisa dibedakan dari luar.
 */
export async function getJurnalGuru(guruId: string, id: string) {
  const [jurnal] = await db
    .select(fieldsDetail)
    .from(teachingJournals)
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .leftJoin(schedules, eq(teachingJournals.scheduleId, schedules.id))
    .where(
      and(eq(teachingJournals.id, id), eq(teachingJournals.guruId, guruId)),
    )
    .limit(1);
  if (!jurnal) return null;

  const kehadiran = await db
    .select({
      muridId: journalAttendances.studentId,
      nama: students.nama,
      hadir: journalAttendances.hadir,
      catatan: journalAttendances.catatan,
    })
    .from(journalAttendances)
    .innerJoin(students, eq(journalAttendances.studentId, students.id))
    .where(eq(journalAttendances.journalId, jurnal.id))
    .orderBy(asc(students.nama));

  return { ...jurnal, kehadiran };
}

export type HasilKoreksiJurnal =
  | {
      status: "tersimpan";
      jurnal: NonNullable<Awaited<ReturnType<typeof getJurnalGuru>>>;
    }
  | { status: "tidak_ada" }
  | { status: "murid_tidak_ada"; muridIds: string[] };

/**
 * Mengoreksi isi jurnal yang pernah dikirim: materi, catatan, dan/atau
 * kehadiran. Kelas, tanggal, dan jam mengajar tidak ikut berubah supaya angka
 * gaji tetap sesuai jadwal. Karena isinya berubah, status kembali ke
 * `terkirim` agar owner meninjau ulang.
 */
export async function koreksiJurnal(
  guruId: string,
  id: string,
  input: KoreksiJurnalInput,
): Promise<HasilKoreksiJurnal> {
  const [milik] = await db
    .select({ id: teachingJournals.id })
    .from(teachingJournals)
    .where(
      and(eq(teachingJournals.id, id), eq(teachingJournals.guruId, guruId)),
    )
    .limit(1);
  if (!milik) return { status: "tidak_ada" };

  const muridIds = input.kehadiran?.map((baris) => baris.muridId) ?? [];
  if (muridIds.length > 0) {
    const dikenal = await db
      .select({ id: students.id })
      .from(students)
      .where(inArray(students.id, muridIds));
    const ketemu = new Set(dikenal.map((murid) => murid.id));
    const tidakDikenal = muridIds.filter((muridId) => !ketemu.has(muridId));
    if (tidakDikenal.length > 0)
      return { status: "murid_tidak_ada", muridIds: tidakDikenal };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(teachingJournals)
      .set({
        status: "terkirim",
        updatedAt: new Date(),
        ...(input.materi === undefined ? {} : { materi: input.materi }),
        ...(input.catatan === undefined ? {} : { catatan: input.catatan }),
      })
      .where(
        and(eq(teachingJournals.id, id), eq(teachingJournals.guruId, guruId)),
      );

    if (!input.kehadiran) return;

    await tx
      .delete(journalAttendances)
      .where(eq(journalAttendances.journalId, id));
    if (input.kehadiran.length > 0) {
      await tx.insert(journalAttendances).values(
        input.kehadiran.map((baris) => ({
          journalId: id,
          studentId: baris.muridId,
          hadir: baris.hadir,
          catatan: baris.catatan,
        })),
      );
    }
  });

  const jurnal = await getJurnalGuru(guruId, id);
  if (!jurnal) return { status: "tidak_ada" };
  return { status: "tersimpan", jurnal };
}

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
export async function listAnyJurnal(
  filter: Omit<ListJurnalHarianInput, "tanggal"> & { tanggal: string },
) {
  const syarat = [eq(teachingJournals.tanggal, filter.tanggal)];
  if (filter.classId) syarat.push(eq(teachingJournals.classId, filter.classId));

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

export type StatusGuruHariIni = {
  guruId: string;
  guruNama: string;
  guruEmail: string;
  jumlahJadwal: number;
  jumlahJurnal: number;
  totalJam: number;
  sudahMengisi: boolean;
};

/**
 * Ringkasan status tiap guru pada satu hari: sudah mengisi jurnal atau belum.
 * Gurunya diambil dari jadwal hari itu, ditambah siapa pun yang sudah mengirim
 * jurnal hari ini (mis. jadwalnya sudah dihapus), supaya tidak ada yang
 * terlewat dari pantauan. Yang belum mengisi tampil lebih dulu.
 */
export async function ringkasanAnyGuruHariIni(
  hari: NamaHari,
  tanggal: string,
): Promise<StatusGuruHariIni[]> {
  const barisJadwal = await db
    .select({
      guruId: schedules.guruId,
      guruNama: user.name,
      guruEmail: user.email,
      jumlahJadwal: sql<number>`count(*)::int`.as("jumlah_jadwal"),
    })
    .from(schedules)
    .innerJoin(user, eq(schedules.guruId, user.id))
    .where(eq(schedules.hari, hari))
    .groupBy(schedules.guruId, user.name, user.email);

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
    .where(eq(teachingJournals.tanggal, tanggal))
    .groupBy(teachingJournals.guruId, user.name, user.email);

  const perGuru = new Map<string, StatusGuruHariIni>();
  for (const baris of barisJadwal) {
    perGuru.set(baris.guruId, {
      ...baris,
      jumlahJurnal: 0,
      totalJam: 0,
      sudahMengisi: false,
    });
  }
  for (const baris of barisJurnal) {
    perGuru.set(baris.guruId, {
      guruId: baris.guruId,
      guruNama: baris.guruNama,
      guruEmail: baris.guruEmail,
      jumlahJadwal: perGuru.get(baris.guruId)?.jumlahJadwal ?? 0,
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
