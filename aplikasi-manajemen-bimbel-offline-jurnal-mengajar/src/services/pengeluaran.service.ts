import "server-only";
import { asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { expenseCategories, expenses } from "@/db/schema";
import { kodeError, pelanggaranUnik } from "@/lib/db-error";
import type {
  KategoriPengeluaran,
  KategoriTerpakai,
  Pengeluaran,
} from "@/lib/pengeluaran";
import type {
  BuatKategoriPengeluaranInput,
  BuatPengeluaranInput,
  ListPengeluaranInput,
  UbahPengeluaranInput,
} from "@/validators/pengeluaran";

// Layanan pengeluaran operasional. Sumbernya tabel `expenses` dan
// `expense_categories` (migrasi 0016). Baris selalu dibaca lewat satu bentuk
// yang sama supaya komponen tidak perlu join sendiri; kolom `catatan` yang
// `null` dikembalikan sebagai teks kosong.

// Kolom yang boleh dilihat klien, dipilih eksplisit; bentuknya mengikuti tipe
// `Pengeluaran` di `src/lib/pengeluaran.ts`.
const kolomPengeluaran = {
  id: expenses.id,
  kategoriId: expenses.kategoriId,
  kategoriNama: expenseCategories.nama,
  nominal: expenses.nominal,
  tanggal: expenses.tanggal,
  catatan: expenses.catatan,
};

type BarisPengeluaran = {
  id: string;
  kategoriId: string;
  kategoriNama: string;
  nominal: number;
  tanggal: string;
  catatan: string | null;
};

function bentukPengeluaran(baris: BarisPengeluaran): Pengeluaran {
  return { ...baris, catatan: baris.catatan ?? "" };
}

// Satu jalur pembacaan supaya bentuk Pengeluaran selalu sama.
async function ambilPengeluaran(
  where: SQL | undefined,
): Promise<Pengeluaran[]> {
  const baris = await db
    .select(kolomPengeluaran)
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenses.kategoriId, expenseCategories.id))
    .where(where)
    .orderBy(desc(expenses.tanggal), desc(expenses.createdAt));

  return baris.map(bentukPengeluaran);
}

/** Semua kategori pengeluaran, diurutkan nama. */
export async function listKategoriPengeluaran(): Promise<
  KategoriPengeluaran[]
> {
  return db
    .select({ id: expenseCategories.id, nama: expenseCategories.nama })
    .from(expenseCategories)
    .orderBy(asc(expenseCategories.nama));
}

/** Satu kategori menurut id, atau `null` kalau id-nya tidak ada. */
export async function getKategoriPengeluaran(
  id: string,
): Promise<KategoriPengeluaran | null> {
  const [baris] = await db
    .select({ id: expenseCategories.id, nama: expenseCategories.nama })
    .from(expenseCategories)
    .where(eq(expenseCategories.id, id));
  return baris ?? null;
}

export type HasilTambahKategori =
  { ok: true; kategori: KategoriPengeluaran } | { ok: false; pesan: string };

/**
 * Menambah kategori baru. Nama yang sudah ada ditolak 409 oleh endpoint-nya;
 * penjaganya tetap indeks unik di basis data supaya kiriman bersamaan tidak
 * menghasilkan dua baris.
 */
export async function tambahKategoriPengeluaran({
  nama,
}: BuatKategoriPengeluaranInput): Promise<HasilTambahKategori> {
  const rapi = nama.trim();
  try {
    const [baris] = await db
      .insert(expenseCategories)
      .values({ nama: rapi })
      .returning({ id: expenseCategories.id, nama: expenseCategories.nama });
    return { ok: true, kategori: baris };
  } catch (error) {
    if (pelanggaranUnik(error))
      return { ok: false, pesan: `Kategori "${rapi}" sudah ada.` };
    throw error;
  }
}

/**
 * Kategori beserta pemakaiannya (jumlah catatan dan total nominal), diurutkan
 * nama. Kategori yang belum dipakai tetap muncul dengan angka 0 lewat join kiri,
 * jadi halaman kelola kategori tidak pernah menyembunyikan kategori kosong.
 */
export async function ringkasanKategoriPengeluaran(): Promise<
  KategoriTerpakai[]
> {
  const baris = await db
    .select({
      id: expenseCategories.id,
      nama: expenseCategories.nama,
      jumlah: sql<number>`count(${expenses.id})::int`,
      total: sql<number>`coalesce(sum(${expenses.nominal}), 0)::float8`,
    })
    .from(expenseCategories)
    .leftJoin(expenses, eq(expenses.kategoriId, expenseCategories.id))
    .groupBy(expenseCategories.id, expenseCategories.nama)
    .orderBy(asc(expenseCategories.nama));

  return baris.map((kategori) => ({
    id: kategori.id,
    nama: kategori.nama,
    jumlah: Number(kategori.jumlah),
    total: Number(kategori.total),
  }));
}

/**
 * Mengganti nama kategori. `null` kalau id-nya tidak ada; nama yang sudah dipakai
 * kategori lain dikembalikan sebagai pesan (409 di endpoint) supaya pengguna
 * tahu apa yang salah, bukan galat kunci unik dari basis data.
 */
export async function ubahKategoriPengeluaran(
  id: string,
  { nama }: BuatKategoriPengeluaranInput,
): Promise<HasilTambahKategori | null> {
  const rapi = nama.trim();
  try {
    const baris = await db
      .update(expenseCategories)
      .set({ nama: rapi })
      .where(eq(expenseCategories.id, id))
      .returning({ id: expenseCategories.id, nama: expenseCategories.nama });
    if (baris.length === 0) return null;
    return { ok: true, kategori: baris[0] };
  } catch (error) {
    if (pelanggaranUnik(error))
      return { ok: false, pesan: `Kategori "${rapi}" sudah ada.` };
    throw error;
  }
}

/** Hasil penghapusan kategori: alasan kegagalannya dibedakan pemanggil. */
export type HasilHapusKategori =
  | { ok: true }
  | { ok: false; alasan: "tidak_ada" | "dipakai" };

/**
 * Menghapus kategori. Kategori yang masih dipakai pengeluaran tidak jadi
 * dihapus: kunci asingnya `restrict` (kode 23503), jadi riwayat pengeluaran
 * selalu punya kategorinya. Hanya id yang tidak ada yang dijawab "tidak_ada".
 */
export async function hapusKategoriPengeluaran(
  id: string,
): Promise<HasilHapusKategori> {
  try {
    const dihapus = await db
      .delete(expenseCategories)
      .where(eq(expenseCategories.id, id))
      .returning({ id: expenseCategories.id });
    return dihapus.length > 0
      ? { ok: true }
      : { ok: false, alasan: "tidak_ada" };
  } catch (error) {
    if (kodeError(error) === "23503") return { ok: false, alasan: "dipakai" };
    throw error;
  }
}

/** Pengeluaran (opsional satu periode), terbaru lebih dulu. */
export async function listPengeluaran({
  periode,
}: ListPengeluaranInput): Promise<Pengeluaran[]> {
  return ambilPengeluaran(
    periode
      ? sql`to_char(${expenses.tanggal}, 'YYYY-MM') = ${periode}`
      : undefined,
  );
}

/** Satu pengeluaran menurut id, atau `null` kalau id-nya tidak ada. */
async function getPengeluaran(id: string): Promise<Pengeluaran | null> {
  const [baris] = await ambilPengeluaran(eq(expenses.id, id));
  return baris ?? null;
}

/**
 * Pengeluaran lama yang dibuat dengan kunci kiriman itu, atau `null` kalau
 * kuncinya belum pernah dipakai. Dipakai jalur idempotensi: kiriman ulang
 * mengembalikan baris yang sudah ada, bukan membuat baris kedua.
 */
async function pengeluaranBerkunci(kunci: string): Promise<Pengeluaran | null> {
  const [baris] = await ambilPengeluaran(eq(expenses.kunci, kunci));
  return baris ?? null;
}

/** Isian yang dinormalisasi seperti yang disimpan tabel `expenses`. */
type IsianTersimpan = {
  kategoriId: string;
  nominal: number;
  tanggal: string;
  catatan: string | null;
};

// Perbandingan isian dipakai saat kunci kiriman sudah terpakai: kiriman ulang
// yang benar-benar sama dianggap percobaan ulang, isian yang berbeda dianggap
// kunci yang salah pakai.
function isianSama(lama: Pengeluaran, baru: IsianTersimpan) {
  return (
    lama.kategoriId === baru.kategoriId &&
    lama.nominal === baru.nominal &&
    lama.tanggal === baru.tanggal &&
    lama.catatan === (baru.catatan ?? "")
  );
}

/** Hasil pencatatan: `diulang` benar kalau barisnya sudah ada dari kiriman sebelumnya. */
export type HasilBuatPengeluaran =
  | { ok: true; pengeluaran: Pengeluaran; diulang: boolean }
  | { ok: false; alasan: "kunci_dipakai_lain" };

/**
 * Mencatat satu pengeluaran baru. Kategorinya diperiksa pemanggil.
 *
 * Kalau `kunci` diisi, pencatatannya idempoten: kiriman dengan kunci yang sama
 * tidak menambah baris kedua — yang dikembalikan baris yang sudah ada, dan
 * `diulang` menandainya. Penjaganya indeks unik `expenses_kunci_unik_idx` di
 * basis data (`onConflictDoNothing`), jadi dua permintaan yang berjalan
 * bersamaan pun hanya menghasilkan satu baris. Kunci yang sudah dipakai untuk
 * isian yang berbeda ditolak (409 di endpoint) supaya kiriman yang salah tidak
 * diam-diam dianggap yang lama.
 */
export async function buatPengeluaran({
  kategoriId,
  nominal,
  tanggal,
  catatan,
  kunci,
}: BuatPengeluaranInput): Promise<HasilBuatPengeluaran> {
  const isian: IsianTersimpan = {
    kategoriId,
    nominal,
    tanggal,
    catatan: catatan?.trim() ? catatan.trim() : null,
  };

  const [baris] = await db
    .insert(expenses)
    .values({ ...isian, kunci: kunci ?? null })
    .onConflictDoNothing({ target: expenses.kunci })
    .returning({ id: expenses.id });

  if (!baris) {
    // Hanya mungkin terjadi kalau kuncinya ada: nilai `null` tidak pernah
    // bentrok di indeks unik.
    const lama = kunci ? await pengeluaranBerkunci(kunci) : null;
    if (!lama)
      throw new Error("Pengeluaran dengan kunci itu tidak ditemukan.");
    return isianSama(lama, isian)
      ? { ok: true, pengeluaran: lama, diulang: true }
      : { ok: false, alasan: "kunci_dipakai_lain" };
  }

  const dibuat = await getPengeluaran(baris.id);
  if (!dibuat) throw new Error("Pengeluaran yang baru dibuat tidak ditemukan.");
  return { ok: true, pengeluaran: dibuat, diulang: false };
}

/**
 * Mengubah sebagian kolom pengeluaran. Mengembalikan `null` kalau id-nya tidak
 * ada. Kolom yang tidak dikirim dibiarkan seperti semula.
 */
export async function ubahPengeluaran(
  id: string,
  input: UbahPengeluaranInput,
): Promise<Pengeluaran | null> {
  const nilai: Partial<{
    kategoriId: string;
    nominal: number;
    tanggal: string;
    catatan: string | null;
  }> = {};

  if (input.kategoriId !== undefined) nilai.kategoriId = input.kategoriId;
  if (input.nominal !== undefined) nilai.nominal = input.nominal;
  if (input.tanggal !== undefined) nilai.tanggal = input.tanggal;
  if (input.catatan !== undefined)
    nilai.catatan = input.catatan.trim() ? input.catatan.trim() : null;

  const diubah = await db
    .update(expenses)
    .set(nilai)
    .where(eq(expenses.id, id))
    .returning({ id: expenses.id });

  if (diubah.length === 0) return null;
  return getPengeluaran(id);
}

/** Menghapus satu pengeluaran. `false` kalau id-nya tidak ada. */
export async function hapusPengeluaran(id: string): Promise<boolean> {
  const dihapus = await db
    .delete(expenses)
    .where(eq(expenses.id, id))
    .returning({ id: expenses.id });
  return dihapus.length > 0;
}

/**
 * Total pengeluaran per periode (`YYYY-MM`) yang punya catatan, dipakai rekap
 * arus kas dan laporan laba rugi. Periode tanpa baris tidak muncul; pemanggil
 * memperlakukannya sebagai nol.
 */
export async function rekapPengeluaranBulanan(): Promise<
  { periode: string; total: number }[]
> {
  const baris = await db
    .select({
      periode: sql<string>`to_char(${expenses.tanggal}, 'YYYY-MM')`,
      total: sql<number>`coalesce(sum(${expenses.nominal}), 0)::float8`,
    })
    .from(expenses)
    .groupBy(sql`to_char(${expenses.tanggal}, 'YYYY-MM')`);

  return baris.map((catatan) => ({
    periode: catatan.periode,
    total: Number(catatan.total),
  }));
}
