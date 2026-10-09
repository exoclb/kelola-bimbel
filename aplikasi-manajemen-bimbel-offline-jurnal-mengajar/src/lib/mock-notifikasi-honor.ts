// Data tiruan untuk kotak notifikasi honor guru.
//
// Komponen `KotakNotifikasiHonorGuru` memakai data ini sebagai pengganti
// sumber data dari tabel `notifications`. Saat endpoint notifikasi honor
// siap, komponen cukup mengganti sumber datanya.

import { formatPeriode } from "@/lib/gaji";

export type NotifikasiHonorTiruan = {
  id: string;
  tipe: "rekap_honor";
  pesan: string;
  sudahDibaca: boolean;
  createdAt: Date;
  /** Nama guru yang rekapnya tersedia. */
  guruNama: string;
  /** Periode rekap dalam bentuk `YYYY-MM`. */
  periode: string;
  /** Total gaji guru pada periode tersebut. */
  totalGaji: number;
};

const SEKARANG = new Date();

function hariLalu(jumlah: number) {
  const tanggal = new Date(SEKARANG);
  tanggal.setDate(tanggal.getDate() - jumlah);
  tanggal.setHours(9, 30, 0, 0);
  return tanggal;
}

/** Empat notifikasi honor tiruan: dua belum dibaca, dua sudah dibaca. */
export const NOTIFIKASI_HONOR_TIRUAN: NotifikasiHonorTiruan[] = [
  {
    id: "tiruan-honor-1",
    tipe: "rekap_honor",
    pesan: `Rekap gaji Ahmad Fauzi periode ${formatPeriode("2026-10")} sudah tersedia. Total: Rp750.000 dari 15 jam mengajar.`,
    sudahDibaca: false,
    createdAt: hariLalu(0),
    guruNama: "Ahmad Fauzi",
    periode: "2026-10",
    totalGaji: 750_000,
  },
  {
    id: "tiruan-honor-2",
    tipe: "rekap_honor",
    pesan: `Rekap gaji Bella Kartika periode ${formatPeriode("2026-10")} sudah tersedia. Total: Rp400.000 dari 8 jam mengajar.`,
    sudahDibaca: false,
    createdAt: hariLalu(1),
    guruNama: "Bella Kartika",
    periode: "2026-10",
    totalGaji: 400_000,
  },
  {
    id: "tiruan-honor-3",
    tipe: "rekap_honor",
    pesan: `Rekap gaji Citra Lestari periode ${formatPeriode("2026-09")} sudah tersedia. Total: Rp450.000 dari 9 jam mengajar.`,
    sudahDibaca: true,
    createdAt: hariLalu(14),
    guruNama: "Citra Lestari",
    periode: "2026-09",
    totalGaji: 450_000,
  },
  {
    id: "tiruan-honor-4",
    tipe: "rekap_honor",
    pesan: `Rekap gaji Ahmad Fauzi periode ${formatPeriode("2026-09")} sudah tersedia. Total: Rp650.000 dari 13 jam mengajar.`,
    sudahDibaca: true,
    createdAt: hariLalu(30),
    guruNama: "Ahmad Fauzi",
    periode: "2026-09",
    totalGaji: 650_000,
  },
];