// Data contoh presensi kehadiran guru per sesi mengajar.
//
// Tabelnya belum ada di database, jadi status kehadiran disimpan di layar.
// Bentuk `PresensiGuru` mengikuti rencana kolom tabelnya (jadwal, status,
// guru pengganti, catatan, dan jejak siapa/kapan terakhir mengubah), sehingga
// nanti tinggal diganti sumbernya.

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
