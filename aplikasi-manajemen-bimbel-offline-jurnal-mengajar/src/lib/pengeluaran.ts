// Hitungan dan bentuk pengeluaran operasional bimbel.
//
// Modul ini melengkapi sisi pengeluaran: pemasukan SPP ada di `src/lib/tagihan.ts`
// dan honor guru di `src/lib/gaji.ts`. Periode memakai bentuk `YYYY-MM` supaya
// seragam dengan modul keuangan lain.

import { periodeBulan } from "@/lib/gaji";

export type KategoriPengeluaran = {
  id: string;
  nama: string;
};

export type Pengeluaran = {
  id: string;
  kategoriId: string;
  /** Nama kategori disalin untuk tampilan, biar baris tidak perlu join. */
  kategoriNama: string;
  nominal: number;
  tanggal: string;
  catatan: string;
};

/** "2026-10" untuk bulan berjalan. */
export function periodePengeluaran(tanggal: Date) {
  return periodeBulan(tanggal);
}

/** Periode satu baris pengeluaran (`YYYY-MM`). */
export function periodeDariPengeluaran(baris: Pengeluaran) {
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
