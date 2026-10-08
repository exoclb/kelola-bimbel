// Bentuk data dan label presensi kehadiran guru.
//
// Presensi guru adalah catatan guru atas sesi mengajarnya sendiri: satu baris
// untuk satu sesi (jadwal mingguan) pada satu tanggal. Sumbernya tabel
// `teacher_attendances` (migrasi 0017) lewat
// `src/services/presensi-guru.service.ts`.
//
// Berkas ini hanya tipe dan fungsi murni, jadi aman dipakai di server maupun
// peramban (komponen klien memakai label dan tipe yang sama).

import { namaHari, type NamaHari } from "@/lib/tanggal";

/** Status kehadiran guru, sama dengan enum `status_kehadiran_guru`. */
export const STATUS_PRESENSI_GURU = [
  "hadir",
  "izin",
  "tidak_hadir",
  "digantikan",
] as const;

export type StatusPresensiGuru = (typeof STATUS_PRESENSI_GURU)[number];

/** Nama status untuk ditampilkan di lencana. */
export function labelStatusPresensi(status: StatusPresensiGuru) {
  switch (status) {
    case "hadir":
      return "Hadir";
    case "izin":
      return "Izin";
    case "tidak_hadir":
      return "Tidak hadir";
    case "digantikan":
      return "Digantikan";
  }
}

/** Keterangan singkat tiap status, dipakai pada pilihan di halaman sesi. */
export function keteranganStatusPresensi(status: StatusPresensiGuru) {
  switch (status) {
    case "hadir":
      return "Saya mengisi sesi ini seperti jadwal.";
    case "izin":
      return "Saya tidak bisa mengisi sesi ini dan sudah memberi kabar.";
    case "tidak_hadir":
      return "Sesi ini tidak saya isi tanpa kabar lebih dulu.";
    case "digantikan":
      return "Sesi ini diisi guru lain yang ditunjuk.";
  }
}

/** Nama hari dari tanggal `YYYY-MM-DD`, untuk mencocokkan jadwal mingguan. */
export function hariDariTanggal(tanggal: string): NamaHari {
  return namaHari(new Date(`${tanggal}T00:00:00`));
}

/**
 * Satu catatan presensi guru yang sudah tersimpan. `diubahOlehNama` kosong
 * kalau akun pengubahnya sudah dihapus (kolomnya `set null`), dan `catatan`
 * kosong kalau memang tidak diisi (kolomnya `null`).
 */
export type PresensiGuru = {
  id: string;
  /** Sesi yang ditandai, merujuk pada jadwal mingguan. */
  jadwalId: string;
  tanggal: string;
  status: StatusPresensiGuru;
  /** Diisi hanya kalau statusnya "digantikan". */
  guruPenggantiId: string | null;
  guruPenggantiNama: string | null;
  catatan: string;
  /** Jejak ringan: siapa dan kapan status terakhir diubah. */
  diubahOlehNama: string | null;
  diubahPada: string;
};

/** Satu sesi mengajar hari ini beserta presensinya (`null` = belum dicatat). */
export type SesiPresensiGuru = {
  jadwalId: string;
  classId: string;
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  /** Murid yang masih aktif di kelas sesi ini, diurutkan nama. */
  murid: { id: string; nama: string }[];
  presensi: PresensiGuru | null;
};

/** Satu baris rekap kehadiran guru (halaman riwayat). */
export type RiwayatKehadiranGuru = {
  id: string;
  jadwalId: string;
  tanggal: string;
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  guruId: string;
  guruNama: string;
  status: StatusPresensiGuru;
  guruPenggantiNama: string | null;
  catatan: string;
  diubahOlehNama: string | null;
  diubahPada: string;
};

/** Jumlah tiap status pada seluruh baris yang cocok penyaring rekap. */
export type RekapKehadiranGuru = {
  total: number;
  hadir: number;
  izin: number;
  tidakHadir: number;
  digantikan: number;
};
