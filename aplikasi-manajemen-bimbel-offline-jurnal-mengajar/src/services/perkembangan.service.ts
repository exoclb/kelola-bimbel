import "server-only";
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { studentProgress, students, user } from "@/db/schema";
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
