// Data contoh untuk halaman rekap gaji.
//
// Tabel `salary_settings` (tarif per jam) dan `salary_recaps` (rekap + status
// pembayaran) belum ada, jadi halaman ini memakai angka tiruan. Bentuk
// `BarisRekapGaji` dan `RincianJam` di bawah sudah mengikuti kolom di PRD, jadi
// saat endpoint gaji siap, halaman cukup mengganti sumber datanya.

import { hitungGaji } from "@/lib/gaji";

export type StatusPembayaran = "belum_dibayar" | "dibayar";

export type RincianJam = {
  tanggal: string;
  namaKelas: string;
  jamMengajar: number;
  jumlahHadir: number;
  jumlahMurid: number;
};

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
  rincian: RincianJam[];
};

export type RekapGaji = {
  periode: string;
  tarifPerJam: number;
  daftar: BarisRekapGaji[];
};

const TARIF_PER_JAM = 50_000;

// `tanggalKe` dan `kelas` dipakai bergantian supaya rinciannya terlihat wajar,
// sementara `jamPerJurnal` menjaga jumlah jam selalu sama dengan totalnya.
const GURU = [
  {
    guruId: "contoh-guru-1",
    guruNama: "Ahmad Fauzi",
    guruEmail: "ahmad@example.test",
    jamPerJurnal: 1.5,
    kelas: ["Matematika SD Kelas 4", "IPA SD Kelas 6"],
    tanggalKe: [2, 5, 7, 12, 14, 19],
    statusPembayaran: "belum_dibayar" as StatusPembayaran,
    tanggalDibayar: null,
  },
  {
    guruId: "contoh-guru-2",
    guruNama: "Bella Kartika",
    guruEmail: "bella@example.test",
    jamPerJurnal: 1,
    kelas: ["Bahasa Inggris SMP Kelas 7"],
    tanggalKe: [3, 6, 10, 17],
    statusPembayaran: "dibayar" as StatusPembayaran,
    tanggalDibayar: "2026-09-30",
  },
  {
    guruId: "contoh-guru-3",
    guruNama: "Citra Lestari",
    guruEmail: "citra@example.test",
    jamPerJurnal: 1.5,
    kelas: ["Calistung TK"],
    tanggalKe: [4, 11, 18],
    statusPembayaran: "belum_dibayar" as StatusPembayaran,
    tanggalDibayar: null,
  },
];

/** Pengganti sementara `GET /api/gaji?periode=YYYY-MM`. */
export function getRekapGajiBulanan(periode: string): RekapGaji {
  const [tahun, bulan] = periode.split("-").map(Number);

  return {
    periode,
    tarifPerJam: TARIF_PER_JAM,
    daftar: GURU.map((guru) => {
      const rincian: RincianJam[] = guru.tanggalKe.map((hari, urutan) => {
        const jumlahMurid = 4;
        return {
          tanggal: `${tahun}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`,
          namaKelas: guru.kelas[urutan % guru.kelas.length],
          jamMengajar: guru.jamPerJurnal,
          jumlahHadir: urutan % 3 === 2 ? jumlahMurid - 1 : jumlahMurid,
          jumlahMurid,
        };
      });
      const totalJam = rincian.reduce(
        (jumlah, baris) => jumlah + baris.jamMengajar,
        0,
      );

      return {
        guruId: guru.guruId,
        guruNama: guru.guruNama,
        guruEmail: guru.guruEmail,
        jumlahJurnal: rincian.length,
        totalJam,
        tarifPerJam: TARIF_PER_JAM,
        totalGaji: hitungGaji(totalJam, TARIF_PER_JAM),
        statusPembayaran: guru.statusPembayaran,
        tanggalDibayar: guru.tanggalDibayar,
        rincian,
      };
    }),
  };
}

export type RingkasanGajiBulanan = {
  periode: string;
  jumlahGuru: number;
  totalJam: number;
  totalGaji: number;
  jumlahDibayar: number;
};

/** Enam bulan terakhir, terbaru lebih dulu, untuk halaman riwayat gaji. */
export function getRiwayatGaji(): RingkasanGajiBulanan[] {
  const sekarang = new Date();
  const bulanIni = sekarang.getMonth() + 1;
  const tahunIni = sekarang.getFullYear();
  const daftar: RingkasanGajiBulanan[] = [];

  for (let mundur = 0; mundur < 6; mundur += 1) {
    const waktu = new Date(tahunIni, bulanIni - 1 - mundur, 1);
    const bulan = waktu.getMonth() + 1;
    const periode = `${waktu.getFullYear()}-${String(bulan).padStart(2, "0")}`;

    // Bulan berjalan memakai angka yang sama dengan halaman rekap gaji.
    const rekap = getRekapGajiBulanan(periode).daftar;
    const faktor = 0.8 + ((bulan % 4) * 10) / 100;
    const jumlahGuru = rekap.length;
    const totalJam =
      mundur === 0
        ? rekap.reduce((jumlah, baris) => jumlah + baris.totalJam, 0)
        : Math.round(
            rekap.reduce((jumlah, baris) => jumlah + baris.totalJam, 0) *
              faktor *
              10,
          ) / 10;
    const totalGaji = hitungGaji(totalJam, TARIF_PER_JAM);
    const jumlahDibayar =
      mundur === 0 ? 1 : mundur === 1 ? jumlahGuru - 1 : jumlahGuru;

    daftar.push({ periode, jumlahGuru, totalJam, totalGaji, jumlahDibayar });
  }

  return daftar;
}

/**
 * Rekap gaji untuk guru yang sedang masuk. Angka jamnya masih contoh, tetapi
 * nama dan akun diambil dari sesi yang asli. Di backend nanti fungsi ini
 * menjadi query jurnal milik guru tersebut pada periode itu.
 */
export function getRekapGajiSaya(
  periode: string,
  guru: { id: string; nama: string; email: string },
): BarisRekapGaji {
  const contoh = getRekapGajiBulanan(periode).daftar[0];
  return {
    ...contoh,
    guruId: guru.id,
    guruNama: guru.nama,
    guruEmail: guru.email,
  };
}
