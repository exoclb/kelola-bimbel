// Data contoh kelas & jadwal.
//
// Tabel `classes` dan `schedules` sudah ada di database, tetapi API-nya belum
// dibuat, jadi halaman ini memakai data tiruan. Bentuk `Kelas` dan `Jadwal`
// mengikuti kolom tabelnya (nama_kelas, cabang, guru_id, hari, jam_mulai,
// jam_selesai), sehingga nanti tinggal diganti sumbernya.

export type JadwalKelas = {
  hari: string;
  jamMulai: string;
  jamSelesai: string;
};

export type Kelas = {
  id: string;
  namaKelas: string;
  cabang: string;
  guruNama: string;
  jadwal: JadwalKelas[];
};

/** Guru yang bisa dipilih saat menambah kelas. */
export const GURU_KELAS = ["Ahmad Fauzi", "Bella Kartika", "Citra Lestari"];

const KELAS: Kelas[] = [
  {
    id: "kls-1",
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    guruNama: "Ahmad Fauzi",
    jadwal: [
      { hari: "Senin", jamMulai: "07:00", jamSelesai: "08:30" },
      { hari: "Rabu", jamMulai: "07:00", jamSelesai: "08:30" },
    ],
  },
  {
    id: "kls-2",
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    guruNama: "Bella Kartika",
    jadwal: [
      { hari: "Selasa", jamMulai: "09:00", jamSelesai: "10:00" },
      { hari: "Kamis", jamMulai: "09:00", jamSelesai: "10:00" },
    ],
  },
  {
    id: "kls-3",
    namaKelas: "IPA SD Kelas 6",
    cabang: "Cabang Utara",
    guruNama: "Ahmad Fauzi",
    jadwal: [{ hari: "Jumat", jamMulai: "10:30", jamSelesai: "12:00" }],
  },
  {
    id: "kls-4",
    namaKelas: "Calistung TK",
    cabang: "Cabang Pusat",
    guruNama: "Citra Lestari",
    jadwal: [{ hari: "Sabtu", jamMulai: "13:00", jamSelesai: "14:00" }],
  },
];

/** Pengganti sementara `GET /api/kelas`. */
export function getDaftarKelas(): Kelas[] {
  return [...KELAS].sort((a, b) =>
    a.namaKelas.localeCompare(b.namaKelas, "id"),
  );
}
