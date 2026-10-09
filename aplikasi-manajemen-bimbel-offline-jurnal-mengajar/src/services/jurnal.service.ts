import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  journalAttendances,
  notifications,
  schedules,
  students,
  teachingJournals,
  user,
  studentEnrollments,
} from "@/db/schema";
import { formatJam } from "@/lib/jurnal";
import { tanggalISO } from "@/lib/tanggal";
import {
  penerimaNotifikasi,
  penerimaPemilik,
} from "@/services/notifikasi.service";
import type {
  KoreksiJurnalInput,
  ListJurnalInput,
  SimpanJurnalInput,
} from "@/validators/jurnal";

export type HasilSimpanJurnal =
  | { status: "tersimpan"; jurnal: JurnalTersimpan }
  | { status: "jadwal_tidak_ada" }
  | { status: "jadwal_tidak_valid" }
  | { status: "murid_tidak_ada"; muridIds: string[] }
  | { status: "murid_tidak_di_kelas"; muridIds: string[] };

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
/**
 * Pisahkan murid yang tidak dikenal dari murid yang dikenal tetapi tidak
 * terdaftar di kelas itu. Kehadiran hanya boleh mencatat murid kelas tersebut:
 * kalau tidak, daftar kehadiran kelas (dan rekap yang dibaca wali) bisa berisi
 * anak dari kelas lain.
 */
async function klasifikasiMuridKelas(classId: string, muridIds: string[]) {
  if (muridIds.length === 0)
    return { tidakDikenal: [] as string[], tidakDiKelas: [] as string[] };

  const dikenal = await db
    .select({ id: students.id })
    .from(students)
    .where(inArray(students.id, muridIds));
  const ketemu = new Set(dikenal.map((murid) => murid.id));
  const tidakDikenal = muridIds.filter((muridId) => !ketemu.has(muridId));

  const terdaftar = await db
    .select({ studentId: studentEnrollments.studentId })
    .from(studentEnrollments)
    .where(
      and(
        eq(studentEnrollments.classId, classId),
        eq(studentEnrollments.status, "aktif"),
        inArray(studentEnrollments.studentId, muridIds),
      ),
    );
  const diKelas = new Set(terdaftar.map((baris) => baris.studentId));
  const tidakDiKelas = muridIds.filter(
    (muridId) => ketemu.has(muridId) && !diKelas.has(muridId),
  );

  return { tidakDikenal, tidakDiKelas };
}

export async function simpanJurnal(
  guruId: string,
  input: SimpanJurnalInput,
): Promise<HasilSimpanJurnal> {
  const [jadwal] = await db
    .select({
      id: schedules.id,
      classId: schedules.classId,
      namaKelas: classes.namaKelas,
      jamMengajar: sql<number>`round(extract(epoch from (${schedules.jamSelesai} - ${schedules.jamMulai})) / 3600, 2)::float8`,
    })
    .from(schedules)
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(and(eq(schedules.id, input.jadwalId), eq(schedules.guruId, guruId)))
    .limit(1);
  if (!jadwal) return { status: "jadwal_tidak_ada" };
  if (!(jadwal.jamMengajar > 0)) return { status: "jadwal_tidak_valid" };

  const muridIds = input.kehadiran.map((baris) => baris.muridId);
  const { tidakDikenal, tidakDiKelas } = await klasifikasiMuridKelas(
    jadwal.classId,
    muridIds,
  );
  if (tidakDikenal.length > 0)
    return { status: "murid_tidak_ada", muridIds: tidakDikenal };
  if (tidakDiKelas.length > 0)
    return { status: "murid_tidak_di_kelas", muridIds: tidakDiKelas };

  const tanggal = tanggalISO(new Date());

  // Pemberitahuan hanya dibuat saat jurnal pertama kali masuk; kirim ulang
  // (memperbarui jurnal) tidak menambah antrean owner lagi.
  const [sudahAda] = await db
    .select({ id: teachingJournals.id })
    .from(teachingJournals)
    .where(
      and(
        eq(teachingJournals.guruId, guruId),
        eq(teachingJournals.scheduleId, jadwal.id),
        eq(teachingJournals.tanggal, tanggal),
      ),
    )
    .limit(1);

  const [guru] = await db
    .select({ nama: user.name })
    .from(user)
    .where(eq(user.id, guruId))
    .limit(1);

  // Penerima dihitung sebelum transaksi: akun pemilik/admin disaring lagi oleh
  // pengaturan notifikasi masing-masing akun.
  const calonPenerima = sudahAda ? [] : await penerimaPemilik();
  const penerima = await penerimaNotifikasi("jurnal_baru", calonPenerima);

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

    if (penerima.length > 0) {
      await tx.insert(notifications).values(
        penerima.map((userId) => ({
          userId,
          tipe: "jurnal_baru",
          pesan: `Jurnal ${jadwal.namaKelas} sudah dikirim ${guru?.nama ?? "guru"} · ${formatJam(jadwal.jamMengajar)}`,
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
  createdAt: teachingJournals.createdAt,
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
  guruId: teachingJournals.guruId,
  guruNama: user.name,
  guruEmail: user.email,
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

// `guruId` diisi untuk membaca jurnal milik sendiri; dibiarkan kosong oleh
// pemanggil lintas akun (endpoint owner) yang sudah dijaga izinnya.
async function ambilDetailJurnal(jurnalId: string, guruId?: string) {
  const syarat = [eq(teachingJournals.id, jurnalId)];
  if (guruId) syarat.push(eq(teachingJournals.guruId, guruId));

  const [jurnal] = await db
    .select(fieldsDetail)
    .from(teachingJournals)
    .innerJoin(classes, eq(teachingJournals.classId, classes.id))
    .innerJoin(user, eq(teachingJournals.guruId, user.id))
    .leftJoin(schedules, eq(teachingJournals.scheduleId, schedules.id))
    .where(and(...syarat))
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

/**
 * Satu jurnal milik guru ini lengkap dengan daftar muridnya. Mengembalikan
 * `null` untuk jurnal yang tidak ada maupun yang bukan milik guru ini, supaya
 * keduanya tidak bisa dibedakan dari luar.
 */
export function getJurnalGuru(guruId: string, id: string) {
  return ambilDetailJurnal(id, guruId);
}

/**
 * Satu jurnal siapa pun, untuk owner. Hanya aman dipanggil dari endpoint yang
 * dijaga `withApiPermission` (atau halaman dengan `requirePermission`).
 */
export function getAnyJurnal(id: string) {
  return ambilDetailJurnal(id);
}

export type HasilKoreksiJurnal =
  | {
      status: "tersimpan";
      jurnal: NonNullable<Awaited<ReturnType<typeof getJurnalGuru>>>;
    }
  | { status: "tidak_ada" }
  | { status: "murid_tidak_ada"; muridIds: string[] }
  | { status: "murid_tidak_di_kelas"; muridIds: string[] };

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
    .select({ id: teachingJournals.id, classId: teachingJournals.classId })
    .from(teachingJournals)
    .where(
      and(eq(teachingJournals.id, id), eq(teachingJournals.guruId, guruId)),
    )
    .limit(1);
  if (!milik) return { status: "tidak_ada" };

  const muridIds = input.kehadiran?.map((baris) => baris.muridId) ?? [];
  const { tidakDikenal, tidakDiKelas } = await klasifikasiMuridKelas(
    milik.classId,
    muridIds,
  );
  if (tidakDikenal.length > 0)
    return { status: "murid_tidak_ada", muridIds: tidakDikenal };
  if (tidakDiKelas.length > 0)
    return { status: "murid_tidak_di_kelas", muridIds: tidakDiKelas };

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
