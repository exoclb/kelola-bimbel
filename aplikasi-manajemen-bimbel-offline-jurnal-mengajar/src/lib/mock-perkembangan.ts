// Data contoh catatan perkembangan anak.
//
// Tabel `student_progress` belum ada di database, jadi halaman ini memakai
// data tiruan. Bentuk `CatatanPerkembangan` mengikuti kolom tabelnya
// (student_id, guru_id, tanggal, nilai, catatan_perkembangan, sikap), sehingga
// nanti tinggal diganti sumbernya.

export type CatatanPerkembangan = {
  id: string;
  muridId: string;
  guruNama: string;
  tanggal: string;
  nilai: number;
  sikap: string;
  catatanPerkembangan: string;
};

/** Pilihan cepat sikap anak selama belajar. */
export const PILIHAN_SIKAP = [
  "Baik",
  "Sangat baik",
  "Cukup",
  "Perlu perhatian",
] as const;

const CATATAN: CatatanPerkembangan[] = [
  {
    id: "prg-1",
    muridId: "mrd-1",
    guruNama: "Ahmad Fauzi",
    tanggal: "2026-09-20",
    nilai: 85,
    sikap: "Sangat baik",
    catatanPerkembangan:
      "Sudah lancar perkalian bersusun, perlu latihan soal cerita.",
  },
  {
    id: "prg-2",
    muridId: "mrd-1",
    guruNama: "Ahmad Fauzi",
    tanggal: "2026-09-27",
    nilai: 90,
    sikap: "Sangat baik",
    catatanPerkembangan: "Soal cerita sudah lebih rapi langkahnya.",
  },
  {
    id: "prg-3",
    muridId: "mrd-2",
    guruNama: "Ahmad Fauzi",
    tanggal: "2026-09-21",
    nilai: 72,
    sikap: "Baik",
    catatanPerkembangan:
      "Masih sering lupa menyimpan pada penjumlahan bersusun.",
  },
  {
    id: "prg-4",
    muridId: "mrd-3",
    guruNama: "Citra Lestari",
    tanggal: "2026-09-18",
    nilai: 78,
    sikap: "Baik",
    catatanPerkembangan: "Membaca sudah lancar, menulis perlu diperbaiki.",
  },
  {
    id: "prg-5",
    muridId: "mrd-4",
    guruNama: "Ahmad Fauzi",
    tanggal: "2026-09-22",
    nilai: 95,
    sikap: "Sangat baik",
    catatanPerkembangan:
      "Cepat menangkap materi baru, bisa diberi soal tantangan.",
  },
  {
    id: "prg-6",
    muridId: "mrd-5",
    guruNama: "Bella Kartika",
    tanggal: "2026-09-19",
    nilai: 68,
    sikap: "Perlu perhatian",
    catatanPerkembangan:
      "Kosakata masih terbatas, perlu latihan harian di rumah.",
  },
  {
    id: "prg-7",
    muridId: "mrd-5",
    guruNama: "Bella Kartika",
    tanggal: "2026-09-26",
    nilai: 74,
    sikap: "Baik",
    catatanPerkembangan: "Ada kemajuan, sudah berani menjawab lisan.",
  },
  {
    id: "prg-8",
    muridId: "mrd-7",
    guruNama: "Bella Kartika",
    tanggal: "2026-09-24",
    nilai: 88,
    sikap: "Sangat baik",
    catatanPerkembangan: "Pengucapan jelas dan percaya diri saat bercerita.",
  },
  {
    id: "prg-9",
    muridId: "mrd-8",
    guruNama: "Ahmad Fauzi",
    tanggal: "2026-09-23",
    nilai: 80,
    sikap: "Baik",
    catatanPerkembangan: "Hafalan perkalian sudah kuat sampai 9.",
  },
];

/** Pengganti sementara `GET /api/perkembangan`. Terbaru lebih dulu. */
export function getCatatanPerkembangan(): CatatanPerkembangan[] {
  return [...CATATAN].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}
