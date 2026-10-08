// Hitungan dan format tagihan murid.
//
// Modul ini melengkapi sisi pemasukan: honor guru sudah dihitung di
// `src/lib/gaji.ts`. Semua bentuk periode di sini memakai `YYYY-MM` supaya
// seragam dengan modul gaji, dan nominal selalu bilangan bulat rupiah.

import { formatPeriode } from "@/lib/gaji";

export type StatusTagihan = "belum_lunas" | "lunas";

/** Satu tagihan murid: bentuk kolomnya mengikuti tabel `student_invoices`. */
export type Tagihan = {
  id: string;
  muridId: string;
  muridNama: string;
  /** Hanya untuk tampilan; di database kelas datang dari penempatan murid. */
  kelasNama: string;
  periodeBulan: number;
  periodeTahun: number;
  nominal: number;
  status: StatusTagihan;
  /** Diisi hanya kalau statusnya "lunas". */
  tanggalBayar: string | null;
  sudahDiingatkan: boolean;
  dibuatPada: string;
};

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

/** Periode satu baris tagihan dalam bentuk `YYYY-MM`. */
export function periodeDariTagihan(baris: Tagihan) {
  return `${baris.periodeTahun}-${String(baris.periodeBulan).padStart(2, "0")}`;
}

/**
 * Status pembayaran satu tagihan untuk penanda di Portal Wali:
 * - `lunas` — sudah dibayar,
 * - `terlambat` — belum dibayar dan periodenya sudah lewat,
 * - `belum` — belum dibayar tetapi periodenya masih berjalan.
 */
export type StatusPembayaran = "lunas" | "belum" | "terlambat";

export function statusPembayaran(
  baris: Tagihan,
  periodeBerjalan: string,
): StatusPembayaran {
  if (baris.status === "lunas") return "lunas";
  return menunggak(periodeDariTagihan(baris), periodeBerjalan, baris.status)
    ? "terlambat"
    : "belum";
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

/**
 * Ringkasan satu periode (`YYYY-MM`) dengan bentuk yang sama seperti
 * `hitungRekapTagihan`, ditambah periodenya. Dipakai rekap pemasukan yang
 * dihitung basis data (`src/services/tagihan.service.ts`), supaya arus kas dan
 * laporan laba rugi menerima angka siap pakai, bukan seluruh baris tagihan.
 */
export type RekapTagihanPeriode = {
  periode: string;
  jumlah: number;
  jumlahLunas: number;
  nominalLunas: number;
  jumlahBelumLunas: number;
  nominalBelumLunas: number;
};

/** Rekap periode tanpa tagihan: semua nol, supaya pemanggil tak perlu bercabang. */
export function rekapTagihanKosong(periode: string): RekapTagihanPeriode {
  return {
    periode,
    jumlah: 0,
    jumlahLunas: 0,
    nominalLunas: 0,
    jumlahBelumLunas: 0,
    nominalBelumLunas: 0,
  };
}
