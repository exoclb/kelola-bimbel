import "server-only";
import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { pelanggaranUnik } from "@/lib/db-error";
import { urutkanJadwal } from "@/lib/tanggal";
import {
  classes,
  schedules,
  studentEnrollments,
  students,
  user,
} from "@/db/schema";
import type {
  CreateKelasInput,
  ListKelasInput,
  TambahJadwalInput,
} from "@/validators/kelas";

export type JadwalTersimpan = {
  id: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
};

export type KelasTersimpan = {
  id: string;
  namaKelas: string;
  cabang: string;
  guruId: string | null;
  guruNama: string | null;
  createdAt: Date;
  jumlahMurid: number;
  jadwal: JadwalTersimpan[];
};

const fields = {
  id: classes.id,
  namaKelas: classes.namaKelas,
  cabang: classes.cabang,
  guruId: classes.guruId,
  guruNama: user.name,
  createdAt: classes.createdAt,
};

async function jumlahMuridPerKelas(kelasIds: string[]) {
  if (kelasIds.length === 0) return new Map<string, number>();

  const baris = await db
    .select({
      kelasId: studentEnrollments.classId,
      jumlah: sql<number>`count(*)::int`.as("jumlah"),
    })
    .from(studentEnrollments)
    .where(
      and(
        inArray(studentEnrollments.classId, kelasIds),
        eq(studentEnrollments.status, "aktif"),
      ),
    )
    .groupBy(studentEnrollments.classId);

  return new Map(baris.map((catatan) => [catatan.kelasId, catatan.jumlah]));
}

async function jadwalPerKelas(kelasIds: string[]) {
  if (kelasIds.length === 0) return new Map<string, JadwalTersimpan[]>();

  const baris = await db
    .select({
      id: schedules.id,
      kelasId: schedules.classId,
      hari: schedules.hari,
      jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
        "jam_mulai",
      ),
      jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
        "jam_selesai",
      ),
    })
    .from(schedules)
    .where(inArray(schedules.classId, kelasIds))
    // Urutan hari (Senin–Minggu) dirapikan setelah query: abjad akan
    // menghasilkan Jumat lebih dulu daripada Senin.
    .orderBy(asc(schedules.jamMulai));

  const perKelas = new Map<string, JadwalTersimpan[]>();
  for (const jadwal of baris) {
    perKelas.set(jadwal.kelasId, [
      ...(perKelas.get(jadwal.kelasId) ?? []),
      {
        id: jadwal.id,
        hari: jadwal.hari,
        jamMulai: jadwal.jamMulai,
        jamSelesai: jadwal.jamSelesai,
      },
    ]);
  }
  for (const daftar of perKelas.values()) daftar.sort(urutkanJadwal);

  return perKelas;
}

/** Satu kelas lengkap dengan jadwalnya, atau `null` kalau tidak ada. */
export async function getKelasById(id: string): Promise<KelasTersimpan | null> {
  const [kelas] = await db
    .select(fields)
    .from(classes)
    .leftJoin(user, eq(classes.guruId, user.id))
    .where(eq(classes.id, id))
    .limit(1);
  if (!kelas) return null;

  const [jadwal, jumlah] = await Promise.all([
    jadwalPerKelas([kelas.id]),
    jumlahMuridPerKelas([kelas.id]),
  ]);
  return {
    ...kelas,
    jumlahMurid: jumlah.get(kelas.id) ?? 0,
    jadwal: jadwal.get(kelas.id) ?? [],
  };
}

/**
 * Daftar kelas beserta jadwalnya, terurut nama. `cari` mencocokkan nama kelas,
 * cabang, atau nama guru pengampu.
 */
export async function listKelas({ limit, offset, cari }: ListKelasInput) {
  const kataKunci = cari?.replaceAll(/[%_\\]/g, "\\$&");
  const syarat = kataKunci
    ? or(
        ilike(classes.namaKelas, `%${kataKunci}%`),
        ilike(classes.cabang, `%${kataKunci}%`),
        ilike(user.name, `%${kataKunci}%`),
      )
    : undefined;

  const rows = await db
    .select(fields)
    .from(classes)
    .leftJoin(user, eq(classes.guruId, user.id))
    .where(syarat)
    .orderBy(asc(classes.namaKelas), asc(classes.id))
    .limit(limit + 1)
    .offset(offset);

  const halaman = rows.slice(0, limit);
  const [jadwal, jumlahMurid] = await Promise.all([
    jadwalPerKelas(halaman.map((kelas) => kelas.id)),
    jumlahMuridPerKelas(halaman.map((kelas) => kelas.id)),
  ]);

  const [jumlah] = await db
    .select({ total: sql<number>`count(*)::int`.as("total") })
    .from(classes)
    .leftJoin(user, eq(classes.guruId, user.id))
    .where(syarat);

  return {
    data: halaman.map((kelas) => ({
      ...kelas,
      jumlahMurid: jumlahMurid.get(kelas.id) ?? 0,
      jadwal: jadwal.get(kelas.id) ?? [],
    })),
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      total: jumlah?.total ?? 0,
    },
  };
}

/**
 * Membuat kelas baru beserta jadwalnya dalam satu transaksi, supaya kelas
 * tanpa jadwal tidak pernah tersimpan setengah jalan.
 */
export async function createKelas(input: CreateKelasInput) {
  const kelasId = await db.transaction(async (tx) => {
    const [kelas] = await tx
      .insert(classes)
      .values({
        namaKelas: input.namaKelas,
        cabang: input.cabang,
        guruId: input.guruId ?? null,
      })
      .returning({ id: classes.id });

    if (input.jadwal.length > 0 && input.guruId) {
      const guruId = input.guruId;
      await tx.insert(schedules).values(
        input.jadwal.map((jadwal) => ({
          classId: kelas.id,
          guruId,
          hari: jadwal.hari,
          jamMulai: `${jadwal.jamMulai}:00`,
          jamSelesai: `${jadwal.jamSelesai}:00`,
        })),
      );
    }

    return kelas.id;
  });

  return getKelasById(kelasId);
}

/**
 * Menambah satu jadwal ke kelas yang sudah ada. Kelas tanpa guru pengampu
 * memakai guru pertama pada jadwal yang sudah ada, dan kalau belum ada sama
 * sekali, jadwal tidak bisa dibuat.
 */
export async function tambahJadwal(
  kelasId: string,
  jadwal: TambahJadwalInput,
): Promise<
  | { status: "tersimpan"; kelas: KelasTersimpan }
  | { status: "kelas_tidak_ada" }
  | { status: "guru_belum_ada" }
  | { status: "jadwal_sudah_ada" }
> {
  const kelas = await getKelasById(kelasId);
  if (!kelas) return { status: "kelas_tidak_ada" };
  if (!kelas.guruId) return { status: "guru_belum_ada" };

  try {
    await db.insert(schedules).values({
      classId: kelasId,
      guruId: kelas.guruId,
      hari: jadwal.hari,
      jamMulai: `${jadwal.jamMulai}:00`,
      jamSelesai: `${jadwal.jamSelesai}:00`,
    });
  } catch (error) {
    if (pelanggaranUnik(error)) return { status: "jadwal_sudah_ada" };
    throw error;
  }

  const terbaru = await getKelasById(kelasId);
  return terbaru
    ? { status: "tersimpan", kelas: terbaru }
    : { status: "kelas_tidak_ada" };
}

/** Menghapus satu jadwal milik kelas tertentu. */
export async function hapusJadwal(kelasId: string, jadwalId: string) {
  const dihapus = await db
    .delete(schedules)
    .where(and(eq(schedules.id, jadwalId), eq(schedules.classId, kelasId)))
    .returning({ id: schedules.id });
  return dihapus.length > 0;
}

export type MuridDiKelasTersimpan = {
  muridId: string;
  nama: string;
  tanggalLahir: string | null;
  namaOrangTua: string | null;
  kontakOrangTua: string | null;
  statusAktif: boolean;
  tanggalMulai: string;
};

/**
 * Murid yang sedang belajar di satu kelas, terurut nama. Hanya penempatan
 * berstatus 'aktif' yang ikut; riwayat yang sudah selesai tidak ditampilkan.
 */
export async function listMuridKelas(
  kelasId: string,
): Promise<MuridDiKelasTersimpan[]> {
  return db
    .select({
      muridId: studentEnrollments.studentId,
      nama: students.nama,
      tanggalLahir: students.tanggalLahir,
      namaOrangTua: students.namaOrangTua,
      kontakOrangTua: students.kontakOrangTua,
      statusAktif: students.statusAktif,
      tanggalMulai: studentEnrollments.tanggalMulai,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .where(
      and(
        eq(studentEnrollments.classId, kelasId),
        eq(studentEnrollments.status, "aktif"),
      ),
    )
    .orderBy(asc(students.nama));
}

export type HasilTempatkanMurid =
  | { status: "tersimpan" }
  | { status: "kelas_tidak_ada" }
  | { status: "murid_tidak_ada" }
  | { status: "sudah_terdaftar" };

/**
 * Menempatkan murid ke kelas. Satu murid hanya boleh punya satu penempatan
 * aktif, jadi murid yang sudah punya kelas lain ditolak — kehadirannya tidak
 * boleh terhitung di dua kelas sekaligus.
 */
export async function tempatkanMurid(
  kelasId: string,
  muridId: string,
  tanggalMulai: string,
): Promise<HasilTempatkanMurid> {
  const [kelas] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, kelasId))
    .limit(1);
  if (!kelas) return { status: "kelas_tidak_ada" };

  const [murid] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, muridId))
    .limit(1);
  if (!murid) return { status: "murid_tidak_ada" };

  try {
    await db.insert(studentEnrollments).values({
      studentId: muridId,
      classId: kelasId,
      tanggalMulai,
    });
  } catch (error) {
    if (pelanggaranUnik(error)) return { status: "sudah_terdaftar" };
    throw error;
  }

  return { status: "tersimpan" };
}

/**
 * Mengeluarkan murid dari kelas: penempatannya ditandai 'selesai', bukan
 * dihapus, supaya riwayatnya tetap bisa ditelusuri.
 */
export async function keluarkanMurid(kelasId: string, muridId: string) {
  const diubah = await db
    .update(studentEnrollments)
    .set({ status: "selesai" })
    .where(
      and(
        eq(studentEnrollments.classId, kelasId),
        eq(studentEnrollments.studentId, muridId),
        eq(studentEnrollments.status, "aktif"),
      ),
    )
    .returning({ id: studentEnrollments.id });
  return diubah.length > 0;
}
