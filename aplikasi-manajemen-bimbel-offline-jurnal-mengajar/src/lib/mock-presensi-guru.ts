// Data contoh presensi kehadiran guru per sesi mengajar.
//
// Tabelnya belum ada di database, jadi status kehadiran disimpan di layar.
// Bentuk `PresensiGuru` mengikuti rencana kolom tabelnya (jadwal, status,
// guru pengganti, catatan, dan jejak siapa/kapan terakhir mengubah), sehingga
// nanti tinggal diganti sumbernya.

import { tanggalISO } from "@/lib/tanggal";

export type StatusPresensiGuru =
  "hadir" | "izin" | "tidak_hadir" | "digantikan";

export type PresensiGuru = {
  /** Sesi yang ditandai, merujuk pada jadwal mingguan. */
  jadwalId: string;
  status: StatusPresensiGuru;
  /** Diisi hanya kalau statusnya "digantikan". */
  guruPenggantiNama: string | null;
  catatan: string;
  /** Jejak ringan: siapa dan kapan status terakhir diubah. */
  diubahOleh: string;
  diubahPada: string;
};

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

// Beberapa sesi sudah ditandai supaya pemuatan ulang status terlihat: guru
// membuka halaman lagi dan tanda itu masih ada. Dua sesi dipilih dari hari
// yang berbeda agar hampir setiap hari ada contohnya.
const PRESENSI: PresensiGuru[] = [
  {
    jadwalId: "jdw-2",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Bu Sari",
    diubahPada: "2026-10-04T08:55:00",
  },
  {
    jadwalId: "jdw-1",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Bu Sari",
    diubahPada: "2026-10-01T07:05:00",
  },
];

/** Pengganti sementara `GET /api/presensi-guru`. */
export function getPresensiGuruAwal(): PresensiGuru[] {
  return PRESENSI.map((baris) => ({ ...baris }));
}

export type RiwayatPresensiGuru = {
  jadwalId: string;
  /** `null` berarti tanda kehadiran sesi itu dibatalkan. */
  status: StatusPresensiGuru | null;
  oleh: string;
  pada: string;
};

// Jejak perubahan contoh, sejalan dengan baris presensi di atas.
const RIWAYAT: RiwayatPresensiGuru[] = [
  {
    jadwalId: "jdw-1",
    status: "hadir",
    oleh: "Bu Sari",
    pada: "2026-10-01T07:05:00",
  },
  {
    jadwalId: "jdw-2",
    status: "hadir",
    oleh: "Bu Sari",
    pada: "2026-10-04T08:55:00",
  },
];

/** Pengganti sementara `GET /api/presensi-guru/riwayat`. */
export function getRiwayatPresensiAwal(): RiwayatPresensiGuru[] {
  return RIWAYAT.map((baris) => ({ ...baris }));
}

/** Catatan kehadiran guru pada satu sesi di tanggal tertentu. */
export type RiwayatKehadiranGuru = {
  id: string;
  tanggal: string;
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  guruNama: string;
  status: StatusPresensiGuru;
  guruPenggantiNama: string | null;
  catatan: string;
  diubahOleh: string;
  diubahPada: string;
};

export type FilterRiwayatKehadiran = {
  guru: string;
  kelas: string;
  dari: string;
  sampai: string;
};

export const FILTER_KEHADIRAN_KOSONG: FilterRiwayatKehadiran = {
  guru: "",
  kelas: "",
  dari: "",
  sampai: "",
};

type KehadiranTersimpan = Omit<
  RiwayatKehadiranGuru,
  "id" | "tanggal" | "diubahPada"
> & {
  hariLalu: number;
  jamDiubah: string;
};

// Sebaran contoh beberapa pekan terakhir: statusnya campur supaya rekap dan
// saringan bisa dicoba, dan satu sesi punya guru pengganti.
const KEHADIRAN: KehadiranTersimpan[] = [
  {
    hariLalu: 0,
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    jamMulai: "07:00",
    jamSelesai: "08:30",
    guruNama: "Bu Sari",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Bu Sari",
    jamDiubah: "06:55",
  },
  {
    hariLalu: 0,
    namaKelas: "IPA SD Kelas 6",
    cabang: "Cabang Utara",
    jamMulai: "10:30",
    jamSelesai: "12:00",
    guruNama: "Bu Sari",
    status: "tidak_hadir",
    guruPenggantiNama: null,
    catatan: "Ada acara keluarga",
    diubahOleh: "Bu Sari",
    jamDiubah: "10:20",
  },
  {
    hariLalu: 1,
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    jamMulai: "09:00",
    jamSelesai: "10:00",
    guruNama: "Pak Hendra",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Pak Hendra",
    jamDiubah: "08:50",
  },
  {
    hariLalu: 2,
    namaKelas: "Matematika SMP Kelas 8",
    cabang: "Cabang Utara",
    jamMulai: "13:00",
    jamSelesai: "14:30",
    guruNama: "Citra Lestari",
    status: "digantikan",
    guruPenggantiNama: "Ahmad Fauzi",
    catatan: "Sakit, digantikan Ahmad Fauzi",
    diubahOleh: "Citra Lestari",
    jamDiubah: "12:40",
  },
  {
    hariLalu: 3,
    namaKelas: "Calistung TK",
    cabang: "Cabang Pusat",
    jamMulai: "15:00",
    jamSelesai: "16:00",
    guruNama: "Bu Sari",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Bu Sari",
    jamDiubah: "14:50",
  },
  {
    hariLalu: 4,
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    jamMulai: "07:00",
    jamSelesai: "08:30",
    guruNama: "Bu Sari",
    status: "izin",
    guruPenggantiNama: null,
    catatan: "Dinas luar kota",
    diubahOleh: "Bu Sari",
    jamDiubah: "06:30",
  },
  {
    hariLalu: 5,
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    jamMulai: "09:00",
    jamSelesai: "10:00",
    guruNama: "Ahmad Fauzi",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Ahmad Fauzi",
    jamDiubah: "08:45",
  },
  {
    hariLalu: 7,
    namaKelas: "IPA SD Kelas 6",
    cabang: "Cabang Utara",
    jamMulai: "10:30",
    jamSelesai: "12:00",
    guruNama: "Bu Sari",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Bu Sari",
    jamDiubah: "10:15",
  },
  {
    hariLalu: 8,
    namaKelas: "Matematika SMP Kelas 8",
    cabang: "Cabang Utara",
    jamMulai: "13:00",
    jamSelesai: "14:30",
    guruNama: "Pak Hendra",
    status: "izin",
    guruPenggantiNama: null,
    catatan: "Keperluan keluarga",
    diubahOleh: "Pak Hendra",
    jamDiubah: "11:30",
  },
  {
    hariLalu: 9,
    namaKelas: "Calistung TK",
    cabang: "Cabang Pusat",
    jamMulai: "15:00",
    jamSelesai: "16:00",
    guruNama: "Citra Lestari",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Citra Lestari",
    jamDiubah: "14:55",
  },
  {
    hariLalu: 11,
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    jamMulai: "07:00",
    jamSelesai: "08:30",
    guruNama: "Bu Sari",
    status: "digantikan",
    guruPenggantiNama: "Citra Lestari",
    catatan: "Mengikuti pelatihan",
    diubahOleh: "Bu Sari",
    jamDiubah: "06:40",
  },
  {
    hariLalu: 14,
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    jamMulai: "09:00",
    jamSelesai: "10:00",
    guruNama: "Bu Sari",
    status: "hadir",
    guruPenggantiNama: null,
    catatan: "",
    diubahOleh: "Bu Sari",
    jamDiubah: "08:55",
  },
];

/** Guru yang punya catatan kehadiran, untuk pilihan pada saringan. */
export function getGuruKehadiran(): string[] {
  return [...new Set(KEHADIRAN.map((baris) => baris.guruNama))].sort((a, b) =>
    a.localeCompare(b, "id"),
  );
}

/** Kelas yang punya catatan kehadiran, untuk pilihan pada saringan. */
export function getKelasKehadiran(): string[] {
  return [...new Set(KEHADIRAN.map((baris) => baris.namaKelas))].sort((a, b) =>
    a.localeCompare(b, "id"),
  );
}

/**
 * Riwayat kehadiran guru, terbaru lebih dulu. Tanggalnya dihitung dari hari ini
 * supaya contohnya ikut bergerak mengikuti tanggal sebenarnya.
 */
export function getRiwayatKehadiranGuru(
  filter: FilterRiwayatKehadiran = FILTER_KEHADIRAN_KOSONG,
): RiwayatKehadiranGuru[] {
  const hariIni = new Date();
  return KEHADIRAN.map(({ hariLalu, jamDiubah, ...baris }, urutan) => {
    const tanggal = new Date(hariIni);
    tanggal.setDate(tanggal.getDate() - hariLalu);
    const tanggalTeks = tanggalISO(tanggal);
    return {
      ...baris,
      id: `pgh-${KEHADIRAN.length - urutan}`,
      tanggal: tanggalTeks,
      diubahPada: `${tanggalTeks}T${jamDiubah}:00`,
    };
  })
    .filter((baris) => !filter.guru || baris.guruNama === filter.guru)
    .filter((baris) => !filter.kelas || baris.namaKelas === filter.kelas)
    .filter((baris) => !filter.dari || baris.tanggal >= filter.dari)
    .filter((baris) => !filter.sampai || baris.tanggal <= filter.sampai)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}
