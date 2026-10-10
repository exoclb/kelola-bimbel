// Hitungan dan bentuk pengeluaran operasional bimbel.
//
// Modul ini melengkapi sisi pengeluaran: pemasukan SPP ada di
// `src/lib/tagihan.ts` dan honor guru di `src/lib/gaji.ts`. Periode memakai
// bentuk `YYYY-MM` supaya seragam dengan modul keuangan lain, dan nominal
// selalu bilangan bulat rupiah.
//
// Sumber datanya tabel `expenses` + `expense_categories` (lihat
// `src/services/pengeluaran.service.ts`). Berkas ini hanya tipe dan hitungan
// murni, jadi aman dipakai di server maupun peramban — dan sengaja tanpa impor
// sama sekali supaya aturan isiannya bisa diuji langsung `node --test` (pola
// yang sama dengan `src/lib/murid.ts`).

export type KategoriPengeluaran = {
  id: string;
  nama: string;
};

/**
 * Kategori beserta pemakaiannya: berapa catatan pengeluaran yang menunjuknya
 * dan berapa total nominalnya. Dipakai halaman kelola kategori supaya keputusan
 * menghapus sebuah kategori berangkat dari angka, bukan tebakan.
 */
export type KategoriTerpakai = KategoriPengeluaran & {
  jumlah: number;
  total: number;
};

/** Satu baris pengeluaran: bentuk kolomnya mengikuti tabel `expenses`. */
export type Pengeluaran = {
  id: string;
  kategoriId: string;
  /** Nama kategori disalin untuk tampilan, biar baris tidak perlu join. */
  kategoriNama: string;
  nominal: number;
  tanggal: string;
  /** Kosong kalau catatannya memang tidak diisi (kolomnya `null` di database). */
  catatan: string;
};

/**
 * "2026-10" untuk bulan berjalan. Bentuknya sama dengan `periodeBulan` di
 * `src/lib/gaji.ts`; disalin ke sini supaya modul ini tetap tanpa impor.
 */
export function periodePengeluaran(tanggal: Date) {
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Isian formulir pengeluaran apa adanya — semuanya teks, seperti nilai kolom
 * input. Dipakai bersama oleh formulir catat dan formulir sunting supaya kedua
 * pintu tulis itu tidak pernah berbeda aturan.
 */
export type IsianPengeluaran = {
  kategoriId: string;
  nominal: string;
  tanggal: string;
  catatan: string;
};

/** Pesan galat per kolom; kolom yang tidak bermasalah tidak muncul. */
export type GalatPengeluaran = Partial<Record<keyof IsianPengeluaran, string>>;

/** Batas nominal mengikuti kolom `numeric(12, 2)` di tabel `expenses`. */
const NOMINAL_MAKS = 9_999_999_999;

/** Batas catatan sama dengan `catatan` di `src/validators/pengeluaran.ts`. */
const CATATAN_MAKS = 500;

/**
 * Aturan isian yang sama untuk mencatat dan menyunting pengeluaran: nominal
 * wajib angka (dibulatkan ke rupiah) lebih dari nol dan tidak melebihi kolomnya,
 * tanggal wajib diisi, ada di kalender, dan tidak melewati `hariIni`, kategori
 * wajib dipilih, dan catatan paling panjang 500 karakter.
 *
 * `hariIni` (`YYYY-MM-DD`) dioper pemanggil supaya aturannya bisa diuji tanpa
 * bergantung pada jam mesin; dibandingkan sebagai teks karena bentuk tanggalnya
 * sudah terurut dari tahun ke hari.
 */
export function validasiIsianPengeluaran(
  isian: IsianPengeluaran,
  hariIni: string,
): GalatPengeluaran {
  const galat: GalatPengeluaran = {};

  const nominal = Number(isian.nominal);
  if (isian.nominal.trim() === "" || !Number.isFinite(nominal) || nominal <= 0) {
    galat.nominal = "Nominal harus angka lebih dari nol.";
  } else if (nominal > NOMINAL_MAKS) {
    galat.nominal = "Nominal terlalu besar.";
  }

  if (!isian.tanggal) {
    galat.tanggal = "Tanggal wajib diisi.";
  } else if (isian.tanggal > hariIni) {
    galat.tanggal = "Tanggal tidak boleh melewati hari ini.";
  }

  if (!isian.kategoriId) galat.kategoriId = "Pilih kategori pengeluaran.";
  if (isian.catatan.length > CATATAN_MAKS) {
    galat.catatan = `Catatan maksimal ${CATATAN_MAKS} karakter.`;
  }

  return galat;
}

/** Isian yang sudah rapi untuk dikirim ke API (`POST`/`PATCH /api/pengeluaran`). */
export function susunPengeluaran(isian: IsianPengeluaran) {
  return {
    kategoriId: isian.kategoriId,
    nominal: Math.round(Number(isian.nominal)),
    tanggal: isian.tanggal,
    catatan: isian.catatan.trim(),
  };
}

/** Periode satu baris pengeluaran (`YYYY-MM`). */
function periodeDariPengeluaran(baris: { tanggal: string }) {
  return baris.tanggal.slice(0, 7);
}

/** Pengeluaran satu periode, terbaru lebih dulu. */
export function pengeluaranPeriode(
  daftar: Pengeluaran[],
  periode: string,
): Pengeluaran[] {
  return daftar
    .filter((baris) => periodeDariPengeluaran(baris) === periode)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/** Jumlah nominal seluruh baris. */
export function hitungTotalPengeluaran(daftar: { nominal: number }[]) {
  return daftar.reduce((jumlah, baris) => jumlah + baris.nominal, 0);
}

/** Total per kategori, terbesar lebih dulu. */
export function totalPerKategori(daftar: Pengeluaran[]) {
  const peta = new Map<string, number>();
  for (const baris of daftar) {
    peta.set(
      baris.kategoriNama,
      (peta.get(baris.kategoriNama) ?? 0) + baris.nominal,
    );
  }
  return [...peta.entries()]
    .map(([nama, nominal]) => ({ nama, nominal }))
    .sort((a, b) => b.nominal - a.nominal);
}
