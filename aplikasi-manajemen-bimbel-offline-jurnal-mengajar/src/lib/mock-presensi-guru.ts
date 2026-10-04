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
