// Data contoh untuk halaman rekap gaji.
//
// Tabel `salary_settings` (tarif per jam) dan `salary_recaps` (rekap + status
// pembayaran) belum ada, jadi halaman ini memakai angka tiruan. Bentuk
// `BarisRekapGaji` di bawah sudah mengikuti kolom di PRD, jadi saat endpoint
// gaji siap, halaman cukup mengganti sumber datanya.

import { hitungGaji } from "@/lib/gaji";

export type StatusPembayaran = "belum_dibayar" | "dibayar";

export type BarisRekapGaji = {
  guruId: string;
  guruNama: string;
  guruEmail: string;
  jumlahJurnal: number;
  totalJam: number;
  tarifPerJam: number;
  totalGaji: number;
  statusPembayaran: StatusPembayaran;
  tanggalDibayar: string | null;
};

export type RekapGaji = {
  periode: string;
  tarifPerJam: number;
  daftar: BarisRekapGaji[];
};

const TARIF_PER_JAM = 50_000;

const GURU: Omit<BarisRekapGaji, "tarifPerJam" | "totalGaji">[] = [
  {
    guruId: "contoh-guru-1",
    guruNama: "Ahmad Fauzi",
    guruEmail: "ahmad@example.test",
    jumlahJurnal: 22,
    totalJam: 33,
    statusPembayaran: "belum_dibayar",
    tanggalDibayar: null,
  },
  {
    guruId: "contoh-guru-2",
    guruNama: "Bella Kartika",
    guruEmail: "bella@example.test",
    jumlahJurnal: 18,
    totalJam: 27,
    statusPembayaran: "dibayar",
    tanggalDibayar: "2026-09-30",
  },
  {
    guruId: "contoh-guru-3",
    guruNama: "Citra Lestari",
    guruEmail: "citra@example.test",
    jumlahJurnal: 12,
    totalJam: 18,
    statusPembayaran: "belum_dibayar",
    tanggalDibayar: null,
  },
];

/** Pengganti sementara `GET /api/gaji?periode=YYYY-MM`. */
export function getRekapGajiBulanan(periode: string): RekapGaji {
  return {
    periode,
    tarifPerJam: TARIF_PER_JAM,
    daftar: GURU.map((baris) => ({
      ...baris,
      tarifPerJam: TARIF_PER_JAM,
      totalGaji: hitungGaji(baris.totalJam, TARIF_PER_JAM),
    })),
  };
}
