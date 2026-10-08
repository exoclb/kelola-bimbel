import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { studentProgress, students, user } from "@/db/schema";
import {
  listKehadiran,
  ringkasanKehadiranPerMurid,
  type DaftarKehadiran,
} from "@/services/kehadiran.service";
import { getMurid } from "@/services/murid.service";
import type {
  CreatePerkembanganInput,
  ListPerkembanganInput,
  UpdatePerkembanganInput,
} from "@/validators/perkembangan";

// Kolom yang dikirim ke klien, sudah dilengkapi nama anak dan nama guru
// penulisnya supaya tampilan tidak perlu mencocokkan sendiri.
const fields = {
  id: studentProgress.id,
  muridId: studentProgress.studentId,
  muridNama: students.nama,
  guruId: studentProgress.guruId,
  guruNama: user.name,
  tanggal: studentProgress.tanggal,
  nilai: studentProgress.nilai,
  sikap: studentProgress.sikap,
  catatanPerkembangan: studentProgress.catatanPerkembangan,
  createdAt: studentProgress.createdAt,
  updatedAt: studentProgress.updatedAt,
};

/** Satu baris catatan perkembangan seperti yang dikirim ke klien. */
export type CatatanPerkembanganTersimpan = {
  id: string;
  muridId: string;
  muridNama: string;
  guruId: string;
  guruNama: string;
  tanggal: string;
  nilai: number;
  sikap: string;
  catatanPerkembangan: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DaftarCatatanPerkembangan = {
  data: CatatanPerkembanganTersimpan[];
  meta: { limit: number; offset: number; hasMore: boolean; total: number };
};

function pilihCatatan() {
  return db
    .select(fields)
    .from(studentProgress)
    .innerJoin(students, eq(studentProgress.studentId, students.id))
    .innerJoin(user, eq(studentProgress.guruId, user.id));
}

/**
 * Catatan terbaru tiap anak — satu baris per anak — untuk kartu halaman
 * perkembangan. Dicari dalam dua langkah supaya tetap memakai indeks
 * (student_id, tanggal) dan tidak menarik seluruh riwayat: dulu tanggal
 * terakhir tiap anak, lalu baris pada tanggal itu yang paling akhir dibuat.
 */
export async function listCatatanTerbaruPerMurid(): Promise<
  CatatanPerkembanganTersimpan[]
> {
  const terakhir = await db
    .select({
      muridId: studentProgress.studentId,
      tanggal: sql<string>`max(${studentProgress.tanggal})`.as("tanggal"),
    })
    .from(studentProgress)
    .groupBy(studentProgress.studentId);

  if (terakhir.length === 0) return [];

  const kandidat = await pilihCatatan()
    .where(
      and(
        inArray(
          studentProgress.studentId,
          terakhir.map((baris) => baris.muridId),
        ),
        inArray(
          studentProgress.tanggal,
          terakhir.map((baris) => baris.tanggal),
        ),
      ),
    )
    .orderBy(desc(studentProgress.tanggal), desc(studentProgress.createdAt));

  const tanggalTerakhir = new Map(
    terakhir.map((baris) => [baris.muridId, baris.tanggal]),
  );
  const terpilih = new Map<string, CatatanPerkembanganTersimpan>();
  for (const baris of kandidat) {
    // Pasangan anak–tanggal yang tidak berpasangan dilewati; yang tersisa
    // diurutkan terbaru lebih dulu sehingga yang pertama itulah catatan
    // terakhir anak tersebut.
    if (tanggalTerakhir.get(baris.muridId) !== baris.tanggal) continue;
    if (!terpilih.has(baris.muridId)) terpilih.set(baris.muridId, baris);
  }

  return [...terpilih.values()];
}

/**
 * Riwayat catatan perkembangan. Tanpa penyaring, seluruh catatan semua anak
 * tampil terbaru lebih dulu; `muridId`, `dari`/`sampai`, dan `cari` mempersempit
 * hasilnya.
 */
export async function listCatatanPerkembangan({
  limit,
  offset,
  muridId,
  dari,
  sampai,
  cari,
}: ListPerkembanganInput): Promise<DaftarCatatanPerkembangan> {
  // Tanda % dan _ pada kata kunci dianggap huruf biasa, bukan pola pencarian.
  const kataKunci = cari?.replaceAll(/[%_\\]/g, "\\$&");
  const syarat = and(
    muridId ? eq(studentProgress.studentId, muridId) : undefined,
    dari ? gte(studentProgress.tanggal, dari) : undefined,
    sampai ? lte(studentProgress.tanggal, sampai) : undefined,
    kataKunci
      ? or(
          ilike(students.nama, `%${kataKunci}%`),
          ilike(studentProgress.catatanPerkembangan, `%${kataKunci}%`),
        )
      : undefined,
  );

  const rows = await pilihCatatan()
    .where(syarat)
    .orderBy(
      desc(studentProgress.tanggal),
      desc(studentProgress.createdAt),
      asc(studentProgress.id),
    )
    .limit(limit + 1)
    .offset(offset);

  const [jumlah] = await db
    .select({ total: sql<number>`count(*)::int`.as("total") })
    .from(studentProgress)
    .innerJoin(students, eq(studentProgress.studentId, students.id))
    .where(syarat);

  return {
    data: rows.slice(0, limit),
    meta: {
      limit,
      offset,
      hasMore: rows.length > limit,
      total: jumlah?.total ?? 0,
    },
  };
}

/**
 * Riwayat catatan beberapa anak sekaligus, terbaru lebih dulu — dipakai Portal
 * Wali supaya seluruh catatan anak yang tertaut ke satu akun wali terbaca dalam
 * satu permintaan, bukan satu query per anak. Daftar id kosong menghasilkan
 * daftar kosong tanpa menyentuh basis data.
 */
export async function listCatatanPerkembanganAnak(
  muridIds: string[],
): Promise<CatatanPerkembanganTersimpan[]> {
  if (muridIds.length === 0) return [];
  return pilihCatatan()
    .where(inArray(studentProgress.studentId, muridIds))
    .orderBy(
      desc(studentProgress.tanggal),
      desc(studentProgress.createdAt),
      asc(studentProgress.id),
    );
}

/** Satu catatan beserta nama anak dan guru penulisnya, atau null. */
export async function getCatatanPerkembangan(
  id: string,
): Promise<CatatanPerkembanganTersimpan | null> {
  const [catatan] = await pilihCatatan()
    .where(eq(studentProgress.id, id))
    .limit(1);
  return catatan ?? null;
}

/**
 * Membaca ulang catatan yang baru saja ditulis. Barisnya pasti ada karena
 * penulisan tepat sebelumnya berhasil; kalau tidak terbaca, itu kesalahan
 * server, bukan kesalahan pemanggil.
 */
async function ambilCatatanWajib(
  id: string,
): Promise<CatatanPerkembanganTersimpan> {
  const catatan = await getCatatanPerkembangan(id);
  if (!catatan) throw new Error(`Catatan ${id} gagal dibaca ulang.`);
  return catatan;
}

export type HasilSimpanCatatan =
  | { status: "tersimpan"; catatan: CatatanPerkembanganTersimpan }
  | { status: "murid_tidak_ada" };

/**
 * Mencatat perkembangan seorang anak. Guru penulisnya diambil dari sesi, bukan
 * dari isi permintaan, supaya catatan tidak bisa diatasnamakan akun lain.
 */
export async function createCatatanPerkembangan(
  guruId: string,
  input: CreatePerkembanganInput,
): Promise<HasilSimpanCatatan> {
  const [murid] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.id, input.muridId))
    .limit(1);
  if (!murid) return { status: "murid_tidak_ada" };

  const [baris] = await db
    .insert(studentProgress)
    .values({
      studentId: input.muridId,
      guruId,
      tanggal: input.tanggal,
      nilai: input.nilai,
      sikap: input.sikap,
      catatanPerkembangan: input.catatanPerkembangan,
    })
    .returning({ id: studentProgress.id });

  return {
    status: "tersimpan",
    catatan: await ambilCatatanWajib(baris!.id),
  };
}

/**
 * Mengubah catatan. Hanya penulisnya sendiri yang boleh — catatan guru lain
 * dijawab seolah tidak ada supaya tidak bisa ditimpa.
 */
export async function updateCatatanPerkembangan(
  guruId: string,
  id: string,
  input: UpdatePerkembanganInput,
): Promise<CatatanPerkembanganTersimpan | null> {
  const [diubah] = await db
    .update(studentProgress)
    .set({
      tanggal: input.tanggal,
      nilai: input.nilai,
      sikap: input.sikap,
      catatanPerkembangan: input.catatanPerkembangan,
    })
    .where(and(eq(studentProgress.id, id), eq(studentProgress.guruId, guruId)))
    .returning({ id: studentProgress.id });

  return diubah ? ambilCatatanWajib(diubah.id) : null;
}

/** Menghapus catatan milik sendiri. */
export async function hapusCatatanPerkembangan(
  guruId: string,
  id: string,
): Promise<boolean> {
  const terhapus = await db
    .delete(studentProgress)
    .where(and(eq(studentProgress.id, id), eq(studentProgress.guruId, guruId)))
    .returning({ id: studentProgress.id });
  return terhapus.length > 0;
}

/** Ringkasan perkembangan satu anak, dipakai laporan agregat. */
export type RingkasanPerkembanganTersimpan = {
  muridId: string;
  muridNama: string;
  jumlahCatatan: number;
  rataNilai: number;
  nilaiTerakhir: number | null;
  sikapTerakhir: string | null;
  tanggalCatatanTerakhir: string | null;
  jumlahPertemuan: number;
  jumlahHadir: number;
};

export type DaftarRingkasanPerkembangan = {
  data: RingkasanPerkembanganTersimpan[];
  meta: {
    limit: number;
    offset: number;
    hasMore: boolean;
    total: number;
    muridPunyaCatatan: number;
    totalCatatan: number;
  };
};

/**
 * Laporan agregat perkembangan anak: satu baris per anak berisi banyaknya
 * catatan, rata-rata dan nilai terakhir, sikap terakhir, serta rekap kehadiran
 * dari jurnal. Anak yang belum pernah dicatat maupun tercatat hadir tidak
 * muncul, dan pencarian nama dilakukan setelah penggabungan supaya hasilnya
 * sama rata untuk anak yang punya catatan maupun yang hanya punya kehadiran.
 */
export async function listRingkasanPerkembangan({
  limit,
  offset,
  muridId,
  dari,
  sampai,
  cari,
}: ListPerkembanganInput): Promise<DaftarRingkasanPerkembangan> {
  const syarat = and(
    muridId ? eq(studentProgress.studentId, muridId) : undefined,
    dari ? gte(studentProgress.tanggal, dari) : undefined,
    sampai ? lte(studentProgress.tanggal, sampai) : undefined,
  );

  const [catatan, terakhir, kehadiran] = await Promise.all([
    db
      .select({
        muridId: studentProgress.studentId,
        jumlahCatatan: sql<number>`count(*)::int`.as("jumlahCatatan"),
        rataNilai:
          sql<number>`coalesce(round(avg(${studentProgress.nilai})::numeric, 1), 0)::float8`.as(
            "rataNilai",
          ),
        tanggalCatatanTerakhir:
          sql<string>`max(${studentProgress.tanggal})::text`.as(
            "tanggalCatatanTerakhir",
          ),
      })
      .from(studentProgress)
      .where(syarat)
      .groupBy(studentProgress.studentId),
    // Nilai dan sikap dari catatan terbaru tiap anak.
    db
      .selectDistinctOn([studentProgress.studentId], {
        muridId: studentProgress.studentId,
        nilaiTerakhir: studentProgress.nilai,
        sikapTerakhir: studentProgress.sikap,
      })
      .from(studentProgress)
      .where(syarat)
      .orderBy(
        asc(studentProgress.studentId),
        desc(studentProgress.tanggal),
        desc(studentProgress.createdAt),
      ),
    ringkasanKehadiranPerMurid({ limit, offset, muridId, dari, sampai }),
  ]);

  const catatanPerMurid = new Map(
    catatan.map((baris) => [baris.muridId, baris]),
  );
  const terakhirPerMurid = new Map(
    terakhir.map((baris) => [baris.muridId, baris]),
  );
  const kehadiranPerMurid = new Map(
    kehadiran.map((baris) => [baris.muridId, baris]),
  );

  const muridIds = [
    ...new Set([...catatanPerMurid.keys(), ...kehadiranPerMurid.keys()]),
  ];
  const namaPerMurid = new Map<string, string>();

  if (muridIds.length > 0) {
    const daftarNama = await db
      .select({ id: students.id, nama: students.nama })
      .from(students)
      .where(inArray(students.id, muridIds));
    for (const murid of daftarNama) namaPerMurid.set(murid.id, murid.nama);
  }

  const kataKunci = cari?.toLowerCase();
  const semua = muridIds
    .map((id) => {
      const ringkas = catatanPerMurid.get(id);
      const nilai = terakhirPerMurid.get(id);
      const hadir = kehadiranPerMurid.get(id);
      return {
        muridId: id,
        muridNama: namaPerMurid.get(id) ?? "Murid",
        jumlahCatatan: ringkas?.jumlahCatatan ?? 0,
        rataNilai: ringkas?.rataNilai ?? 0,
        nilaiTerakhir: nilai?.nilaiTerakhir ?? null,
        sikapTerakhir: nilai?.sikapTerakhir ?? null,
        tanggalCatatanTerakhir: ringkas?.tanggalCatatanTerakhir ?? null,
        jumlahPertemuan: hadir?.pertemuan ?? 0,
        jumlahHadir: hadir?.hadir ?? 0,
      };
    })
    .filter(
      (baris) =>
        !kataKunci || baris.muridNama.toLowerCase().includes(kataKunci),
    )
    .sort((a, b) => a.muridNama.localeCompare(b.muridNama));

  return {
    data: semua.slice(offset, offset + limit),
    meta: {
      limit,
      offset,
      hasMore: semua.length > offset + limit,
      total: semua.length,
      muridPunyaCatatan: semua.filter((baris) => baris.jumlahCatatan > 0)
        .length,
      totalCatatan: semua.reduce(
        (total, baris) => total + baris.jumlahCatatan,
        0,
      ),
    },
  };
}

/** Riwayat lengkap satu anak untuk halaman riwayat dan laporan orang tua. */
export type RiwayatPerkembangan = {
  murid: {
    id: string;
    nama: string;
    tanggalLahir: string | null;
    namaOrangTua: string | null;
    kontakOrangTua: string | null;
    statusAktif: boolean;
  };
  ringkasan: RingkasanPerkembanganTersimpan;
  catatan: DaftarCatatanPerkembangan;
  kehadiran: DaftarKehadiran;
};

/**
 * Riwayat perkembangan satu anak dalam satu permintaan: data anaknya, ringkasan
 * angkanya, seluruh catatan guru, dan rekap kehadirannya. Dipakai halaman
 * riwayat dan laporan ke orang tua supaya keduanya melihat angka yang sama
 * persis.
 */
export async function getRiwayatPerkembangan(
  muridId: string,
  limit: number,
  offset: number,
): Promise<RiwayatPerkembangan | null> {
  const murid = await getMurid(muridId);
  if (!murid) return null;

  const [ringkasan, catatan, kehadiran] = await Promise.all([
    listRingkasanPerkembangan({
      limit: 1,
      offset: 0,
      muridId,
      dari: undefined,
      sampai: undefined,
      cari: undefined,
    }),
    listCatatanPerkembangan({
      limit,
      offset,
      muridId,
      dari: undefined,
      sampai: undefined,
      cari: undefined,
    }),
    listKehadiran({ limit, offset, muridId }),
  ]);

  return {
    murid,
    ringkasan: ringkasan.data[0] ?? {
      muridId: murid.id,
      muridNama: murid.nama,
      jumlahCatatan: 0,
      rataNilai: 0,
      nilaiTerakhir: null,
      sikapTerakhir: null,
      tanggalCatatanTerakhir: null,
      jumlahPertemuan: 0,
      jumlahHadir: 0,
    },
    catatan,
    kehadiran,
  };
}
