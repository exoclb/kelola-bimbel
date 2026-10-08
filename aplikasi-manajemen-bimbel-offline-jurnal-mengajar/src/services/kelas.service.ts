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
  UpdateKelasInput,
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

/** Benar kalau akun guru dengan id itu ada di tabel pengguna. */
export async function adaGuru(guruId: string) {
  const [guru] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, guruId))
    .limit(1);
  return Boolean(guru);
}

export type HasilUbahKelas =
  | { status: "tersimpan"; kelas: KelasTersimpan }
  | { status: "kelas_tidak_ada" }
  | { status: "guru_tidak_ada" }
  | {
      status: "bentrok";
      bentrok: BentrokJadwal & { jenis?: JenisBentrokJadwal };
    };

export type BentrokJadwal = {
  namaKelas: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
};

/**
 * Asal bentroknya: `kelas` (jadwal kelas ini sendiri beririsan) atau `guru`
 * (guru yang sama mengajar di kelas lain).
 *
 * Cabang sengaja tidak dijadikan patokan: satu cabang menampung banyak kelas,
 * jadi dua kelas di cabang yang sama boleh berjalan pada jam yang sama. Bentrok
 * per ruang baru bisa dijaga kalau kelas punya kolom ruang sendiri.
 */
export type JenisBentrokJadwal = "kelas" | "guru";

export type BentrokJadwalLengkap = BentrokJadwal & {
  jenis: JenisBentrokJadwal;
};

/** Kalimat bentrok yang dipakai seluruh endpoint jadwal supaya seragam. */
export function pesanBentrokJadwal(
  bentrok: BentrokJadwal & { jenis?: JenisBentrokJadwal },
) {
  const waktu = `${bentrok.hari} ${bentrok.jamMulai}–${bentrok.jamSelesai}`;
  if (bentrok.jenis === "kelas")
    return `Jam itu bentrok dengan jadwal kelas ini pada ${waktu}.`;
  if (bentrok.jenis === "guru")
    return `Jadwal ini bentrok dengan ${bentrok.namaKelas} milik guru yang sama pada ${waktu}.`;
  const kelas = bentrok.namaKelas ? ` dengan ${bentrok.namaKelas}` : "";
  return `Jadwal ini bentrok${kelas} pada ${waktu}.`;
}

/** Benar kalau dua rentang jam di hari yang sama saling menimpa. */
function irisanJam(
  a: { hari: string; jamMulai: string; jamSelesai: string },
  b: { hari: string; jamMulai: string; jamSelesai: string },
) {
  return (
    a.hari === b.hari && a.jamMulai < b.jamSelesai && b.jamMulai < a.jamSelesai
  );
}

/** Bentrok di dalam satu daftar jadwal yang sedang dikirim (mis. saat membuat kelas). */
export function cariBentrokDiDaftar(
  jadwal: { hari: string; jamMulai: string; jamSelesai: string }[],
): BentrokJadwal | null {
  for (let i = 0; i < jadwal.length; i += 1) {
    for (let j = i + 1; j < jadwal.length; j += 1) {
      if (irisanJam(jadwal[i], jadwal[j])) {
        const jamMulai = [jadwal[i], jadwal[j]].sort((a, b) =>
          a.jamMulai.localeCompare(b.jamMulai),
        )[0];
        return { namaKelas: "", ...jamMulai };
      }
    }
  }
  return null;
}

/**
 * Jadwal kelas ini sendiri yang beririsan dengan jadwal baru. Dipakai sebelum
 * menyimpan: jam yang bertumpuk membuat kelas punya dua sesi sekaligus, dan
 * indeks unik `(class_id, hari, jam_mulai)` tidak menangkapnya karena jam
 * mulainya berbeda.
 */
export function cariBentrokKelas(
  jadwalLama: { hari: string; jamMulai: string; jamSelesai: string }[],
  jadwalBaru: { hari: string; jamMulai: string; jamSelesai: string }[],
): BentrokJadwalLengkap | null {
  const lama = jadwalLama.find((sebelumnya) =>
    jadwalBaru.some((baru) => irisanJam(baru, sebelumnya)),
  );
  return lama
    ? {
        jenis: "kelas",
        namaKelas: "",
        hari: lama.hari,
        jamMulai: lama.jamMulai,
        jamSelesai: lama.jamSelesai,
      }
    : null;
}

/**
 * Mencari jadwal **guru yang sama** yang beririsan dengan jadwal yang mau
 * disimpan. Seorang guru tidak mungkin mengajar dua kelas sekaligus, jadi
 * jadwalnya dianggap bentrok walau kelasnya berbeda. `kecualiKelasId` dipakai
 * saat mengubah kelas yang sudah ada supaya jadwalnya sendiri tidak ikut
 * dihitung.
 *
 * Cabang sengaja tidak dijadikan patokan: satu cabang menampung banyak kelas,
 * jadi dua kelas di cabang yang sama boleh berjalan pada jam yang sama.
 */
export async function cariBentrokJadwal({
  jadwalBaru,
  guruId,
  kecualiKelasId,
}: {
  jadwalBaru: { hari: string; jamMulai: string; jamSelesai: string }[];
  guruId: string;
  kecualiKelasId?: string;
}): Promise<BentrokJadwalLengkap | null> {
  if (jadwalBaru.length === 0) return null;

  const syarat = [
    eq(schedules.guruId, guruId),
    inArray(schedules.hari, [...new Set(jadwalBaru.map((j) => j.hari))]),
  ];
  if (kecualiKelasId)
    syarat.push(sql`${schedules.classId} <> ${kecualiKelasId}`);

  const baris = await db
    .select({
      namaKelas: classes.namaKelas,
      hari: schedules.hari,
      jamMulai: sql<string>`to_char(${schedules.jamMulai}, 'HH24:MI')`.as(
        "jam_mulai",
      ),
      jamSelesai: sql<string>`to_char(${schedules.jamSelesai}, 'HH24:MI')`.as(
        "jam_selesai",
      ),
    })
    .from(schedules)
    .innerJoin(classes, eq(schedules.classId, classes.id))
    .where(and(...syarat))
    .orderBy(asc(schedules.hari), asc(schedules.jamMulai));

  const lama = baris.find((sebelumnya) =>
    jadwalBaru.some((baru) => irisanJam(baru, sebelumnya)),
  );
  return lama ? { jenis: "guru", ...lama } : null;
}

/**
 * Mengubah data kelas: nama, cabang, dan guru pengampu. Guru pengampu ikut
 * dipindahkan ke seluruh jadwal kelas itu karena jurnal, kehadiran, dan gaji
 * membaca guru dari jadwal — kalau tidak, kelas akan tampak diampu guru baru
 * sementara jurnalnya tetap milik guru lama.
 */
export async function updateKelas(
  kelasId: string,
  input: UpdateKelasInput,
): Promise<HasilUbahKelas> {
  const kelas = await getKelasById(kelasId);
  if (!kelas) return { status: "kelas_tidak_ada" };
  if (input.guruId !== undefined && !(await adaGuru(input.guruId))) {
    return { status: "guru_tidak_ada" };
  }

  // Guru baru membawa serta seluruh jadwal kelas ini, jadi jadwalnya harus
  // luang: tidak beririsan satu sama lain maupun dengan jadwal kelas lain
  // miliknya.
  if (input.guruId !== undefined && input.guruId !== kelas.guruId) {
    const diDaftar = cariBentrokDiDaftar(kelas.jadwal);
    if (diDaftar)
      return {
        status: "bentrok",
        bentrok: { ...diDaftar, namaKelas: kelas.namaKelas, jenis: "kelas" },
      };

    const bentrok = await cariBentrokJadwal({
      jadwalBaru: kelas.jadwal,
      guruId: input.guruId,
      kecualiKelasId: kelasId,
    });
    if (bentrok) return { status: "bentrok", bentrok };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(classes)
      .set({
        ...(input.namaKelas !== undefined
          ? { namaKelas: input.namaKelas }
          : {}),
        ...(input.cabang !== undefined ? { cabang: input.cabang } : {}),
        ...(input.guruId !== undefined ? { guruId: input.guruId } : {}),
      })
      .where(eq(classes.id, kelasId));

    if (input.guruId !== undefined) {
      await tx
        .update(schedules)
        .set({ guruId: input.guruId })
        .where(eq(schedules.classId, kelasId));
    }
  });

  const terbaru = await getKelasById(kelasId);
  return terbaru
    ? { status: "tersimpan", kelas: terbaru }
    : { status: "kelas_tidak_ada" };
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
  | {
      status: "bentrok";
      bentrok: BentrokJadwal & { jenis?: JenisBentrokJadwal };
    }
> {
  const kelas = await getKelasById(kelasId);
  if (!kelas) return { status: "kelas_tidak_ada" };
  if (!kelas.guruId) return { status: "guru_belum_ada" };

  // Jadwal dengan hari & jam mulai yang sama persis di kelas ini ditolak
  // lebih dulu, supaya pesannya "sudah ada" dan bukan "bentrok".
  if (
    kelas.jadwal.some(
      (lama) => lama.hari === jadwal.hari && lama.jamMulai === jadwal.jamMulai,
    )
  ) {
    return { status: "jadwal_sudah_ada" };
  }

  // Jam yang beririsan dengan jadwal kelas ini sendiri, lalu dengan jadwal
  // kelas lain milik guru yang sama.
  const bentrokKelas = cariBentrokKelas(kelas.jadwal, [jadwal]);
  if (bentrokKelas) return { status: "bentrok", bentrok: bentrokKelas };

  const bentrokGuru = await cariBentrokJadwal({
    jadwalBaru: [jadwal],
    guruId: kelas.guruId,
  });
  if (bentrokGuru) return { status: "bentrok", bentrok: bentrokGuru };

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
  /** `aktif` atau `selesai`; `selesai` berarti penempatan lama yang jadi riwayat. */
  statusPenempatan: string;
};

/** Benar kalau kelas dengan id itu ada. */
export async function adaKelas(kelasId: string) {
  const [kelas] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.id, kelasId))
    .limit(1);
  return Boolean(kelas);
}

/**
 * Murid yang sedang belajar di satu kelas, terurut nama. Hanya penempatan
 * berstatus 'aktif' yang ikut; riwayat yang sudah selesai tidak ditampilkan.
 */
export async function listMuridKelas(
  kelasId: string,
  { sertakanRiwayat = false }: { sertakanRiwayat?: boolean } = {},
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
      statusPenempatan: studentEnrollments.status,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .where(
      sertakanRiwayat
        ? eq(studentEnrollments.classId, kelasId)
        : and(
            eq(studentEnrollments.classId, kelasId),
            eq(studentEnrollments.status, "aktif"),
          ),
    )
    .orderBy(asc(studentEnrollments.status), asc(students.nama));
}

export type HasilTempatkanMurid =
  | { status: "tersimpan" }
  | { status: "kelas_tidak_ada" }
  | { status: "murid_tidak_ada" }
  | { status: "murid_tidak_aktif" }
  | { status: "sudah_terdaftar" };

/**
 * Menempatkan murid ke kelas. Sejak aturan multi-kelas berlaku, satu murid
 * boleh aktif di beberapa kelas sekaligus (mis. kelas matematika dan kelas
 * bahasa); yang ditolak hanya pasangan yang sama, yaitu murid yang sudah aktif
 * di kelas itu — kalau tidak, kehadirannya terhitung dua kali di kelas yang
 * sama. Penjagaannya ada di indeks unik parsial
 * `student_enrollments_student_kelas_aktif_idx`, bukan di pemeriksaan awal,
 * supaya dua permintaan bersamaan pun tidak bisa menyisipkan dobel.
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
    .select({ id: students.id, statusAktif: students.statusAktif })
    .from(students)
    .where(eq(students.id, muridId))
    .limit(1);
  if (!murid) return { status: "murid_tidak_ada" };
  // Murid yang sudah dinonaktifkan tidak ditempatkan lagi; aktifkan dulu di
  // halaman Murid. Aturan yang sama ditampilkan panel kelas di layar.
  if (!murid.statusAktif) return { status: "murid_tidak_aktif" };

  try {
    await db.insert(studentEnrollments).values({
      studentId: muridId,
      classId: kelasId,
      tanggalMulai,
    });
  } catch (error) {
    // Indeks unik parsial menolak penempatan kedua di kelas yang sama, jadi
    // hasilnya penolakan yang rapi, bukan galat server.
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

export type PenempatanTersimpan = {
  id: string;
  muridId: string;
  muridNama: string;
  kelasId: string;
  kelasNama: string;
  cabang: string;
  guruNama: string | null;
  tanggalMulai: string;
  status: "aktif" | "selesai";
};

export type DaftarPenempatan = {
  data: PenempatanTersimpan[];
  meta: { limit: number; offset: number; total: number; aktif: number };
};

/**
 * Daftar penempatan murid lintas kelas, lengkap dengan riwayatnya: penempatan
 * yang sudah ditandai `selesai` tetap muncul supaya kelas yang pernah diikuti
 * seorang anak bisa ditelusuri. Saringan `muridId`, `kelasId`, dan `status`
 * dikerjakan di database.
 */
export async function listPenempatan(filter: {
  limit: number;
  offset: number;
  muridId?: string;
  kelasId?: string;
  status?: "aktif" | "selesai";
}): Promise<DaftarPenempatan> {
  const syarat = and(
    filter.muridId
      ? eq(studentEnrollments.studentId, filter.muridId)
      : undefined,
    filter.kelasId ? eq(studentEnrollments.classId, filter.kelasId) : undefined,
    filter.status ? eq(studentEnrollments.status, filter.status) : undefined,
  );

  const baris = await db
    .select({
      id: studentEnrollments.id,
      muridId: studentEnrollments.studentId,
      muridNama: students.nama,
      kelasId: studentEnrollments.classId,
      kelasNama: classes.namaKelas,
      cabang: classes.cabang,
      guruNama: user.name,
      tanggalMulai: studentEnrollments.tanggalMulai,
      status: studentEnrollments.status,
    })
    .from(studentEnrollments)
    .innerJoin(students, eq(studentEnrollments.studentId, students.id))
    .innerJoin(classes, eq(studentEnrollments.classId, classes.id))
    .leftJoin(user, eq(classes.guruId, user.id))
    .where(syarat)
    .orderBy(
      asc(studentEnrollments.status),
      asc(classes.namaKelas),
      asc(students.nama),
    )
    .limit(filter.limit + 1)
    .offset(filter.offset);

  const adaLagi = baris.length > filter.limit;
  const data = adaLagi ? baris.slice(0, filter.limit) : baris;

  const [jumlah] = await db
    .select({
      total: sql<number>`count(*)::int`.as("total"),
      aktif:
        sql<number>`count(*) filter (where ${studentEnrollments.status} = 'aktif')::int`.as(
          "aktif",
        ),
    })
    .from(studentEnrollments)
    .where(syarat);

  return {
    data: data as PenempatanTersimpan[],
    meta: {
      limit: filter.limit,
      offset: filter.offset,
      total: jumlah?.total ?? 0,
      aktif: jumlah?.aktif ?? 0,
    },
  };
}
