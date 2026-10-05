// Hitungan dan format tagihan murid.
//
// Modul ini melengkapi sisi pemasukan: honor guru sudah dihitung di
// `src/lib/gaji.ts`. Semua bentuk periode di sini memakai `YYYY-MM` supaya
// seragam dengan modul gaji, dan nominal selalu bilangan bulat rupiah.

import { formatPeriode } from "@/lib/gaji";

export type StatusTagihan = "belum_lunas" | "lunas";

/** "2026-10" untuk bulan berjalan. */
export function periodeTagihan(tanggal: Date) {
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" digeser beberapa bulan, mis. `geserPeriode("2026-01", -1)` → "2025-12". */
export function geserPeriode(periode: string, bulan: number) {
  const [tahun, urutan] = periode.split("-").map(Number);
  const hasil = new Date(tahun, urutan - 1 + bulan, 1);
  return periodeTagihan(hasil);
}

/** "2026-10" → "Oktober 2026" (mengikuti format periode gaji). */
export function formatPeriodeTagihan(periode: string) {
  return formatPeriode(periode);
}

/**
 * Jarak bulan antara dua periode (`YYYY-MM`). Hasil positif berarti periode
 * pertama lebih baru. Dipakai untuk menghitung umur tunggakan.
 */
export function selisihBulan(periode: string, pembanding: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const [tahunLawan, bulanLawan] = pembanding.split("-").map(Number);
  return (tahun - tahunLawan) * 12 + (bulan - bulanLawan);
}

/** Tagihan dianggap menunggak bila belum lunas dan periodenya sudah lewat. */
export function menunggak(
  periode: string,
  periodeBerjalan: string,
  status: StatusTagihan,
) {
  return status === "belum_lunas" && selisihBulan(periode, periodeBerjalan) < 0;
}

/** Nama status tagihan untuk ditampilkan di lencana. */
export function labelStatusTagihan(status: StatusTagihan) {
  return status === "lunas" ? "Lunas" : "Belum lunas";
}

/** Ringkasan sederhana satu periode, dipakai halaman daftar dan rekap. */
export function hitungRekapTagihan(
  daftar: { nominal: number; status: StatusTagihan }[],
) {
  const lunas = daftar.filter((baris) => baris.status === "lunas");
  const belumLunas = daftar.filter((baris) => baris.status === "belum_lunas");
  return {
    jumlah: daftar.length,
    jumlahLunas: lunas.length,
    jumlahBelumLunas: belumLunas.length,
    nominalLunas: lunas.reduce((jumlah, baris) => jumlah + baris.nominal, 0),
    nominalBelumLunas: belumLunas.reduce(
      (jumlah, baris) => jumlah + baris.nominal,
      0,
    ),
  };
}
