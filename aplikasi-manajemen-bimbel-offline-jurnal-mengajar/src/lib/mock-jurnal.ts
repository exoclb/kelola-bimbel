// Data contoh sementara untuk halaman Jurnal Ngajar.
//
// Backend belum ada di fase ini, jadi halaman memakai jadwal & murid tiruan.
// Saat task backend selesai, ganti pemanggilan fungsi di sini dengan service
// (`src/services/jurnal.service.ts`) dan API route (`/api/jurnal`) — bentuk
// `JurnalInput` di bawah sudah mengikuti tabel teaching_journals &
// journal_attendances di PRD, jadi kontraknya tidak perlu berubah.

export type MuridKelas = {
  id: string;
  nama: string;
};

export type JadwalHariIni = {
  id: string;
  kelasId: string;
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  murid: MuridKelas[];
};

export type KehadiranMurid = {
  muridId: string;
  hadir: boolean;
  catatan: string;
};

export type JurnalInput = {
  jadwalId: string;
  kelasId: string;
  tanggal: string;
  materi: string;
  catatan: string;
  kehadiran: KehadiranMurid[];
};

/** Pilihan cepat materi supaya guru tidak perlu menulis panjang. */
export const PILIHAN_MATERI = [
  "Materi baru",
  "Lanjutan materi",
  "Latihan soal",
  "Pembahasan PR",
  "Kuis / evaluasi",
  "Ulangan",
] as const;

export const JADWAL_HARI_INI: JadwalHariIni[] = [
  {
    id: "jdw-1",
    kelasId: "kls-1",
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    jamMulai: "07:00",
    jamSelesai: "08:30",
    murid: [
      { id: "mrd-1", nama: "Aisyah Putri" },
      { id: "mrd-2", nama: "Bima Saputra" },
      { id: "mrd-3", nama: "Citra Ayu" },
      { id: "mrd-4", nama: "Dimas Pratama" },
    ],
  },
  {
    id: "jdw-2",
    kelasId: "kls-2",
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    jamMulai: "09:00",
    jamSelesai: "10:00",
    murid: [
      { id: "mrd-5", nama: "Eka Lestari" },
      { id: "mrd-6", nama: "Fajar Nugroho" },
      { id: "mrd-7", nama: "Gita Permata" },
    ],
  },
  {
    id: "jdw-3",
    kelasId: "kls-3",
    namaKelas: "IPA SD Kelas 6",
    cabang: "Cabang Utara",
    jamMulai: "10:30",
    jamSelesai: "12:00",
    murid: [
      { id: "mrd-8", nama: "Hana Salsabila" },
      { id: "mrd-9", nama: "Irfan Maulana" },
      { id: "mrd-10", nama: "Jihan Aulia" },
      { id: "mrd-11", nama: "Kevin Ardian" },
      { id: "mrd-12", nama: "Laras Widya" },
    ],
  },
  {
    id: "jdw-4",
    kelasId: "kls-4",
    namaKelas: "Matematika SMP Kelas 8",
    cabang: "Cabang Utara",
    jamMulai: "13:00",
    jamSelesai: "14:30",
    murid: [
      { id: "mrd-13", nama: "Made Surya" },
      { id: "mrd-14", nama: "Nadia Rahma" },
      { id: "mrd-15", nama: "Oskar Pratama" },
    ],
  },
];

/** Jam mengajar dipakai untuk hitung gaji, jadi angkanya diambil dari jadwal. */
export function hitungJamMengajar(jamMulai: string, jamSelesai: string) {
  const [jamAwal, menitAwal] = jamMulai.split(":").map(Number);
  const [jamAkhir, menitAkhir] = jamSelesai.split(":").map(Number);
  const selisihMenit = jamAkhir * 60 + menitAkhir - (jamAwal * 60 + menitAwal);
  return Math.round((selisihMenit / 60) * 10) / 10;
}

export function formatJam(nilai: number) {
  return `${nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
}

/**
 * Pengganti sementara `POST /api/jurnal`. Mengembalikan hasil yang sama
 * seperti API supaya halaman tidak perlu banyak berubah saat backend siap.
 */
export async function kirimJurnalStub(jurnal: JurnalInput) {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 500);
  await promise;
  return { ok: true as const, jumlahHadir: jurnal.kehadiran.filter((baris) => baris.hadir).length };
}
