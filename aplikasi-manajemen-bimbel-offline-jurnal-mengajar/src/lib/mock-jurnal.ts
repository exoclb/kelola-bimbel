// Data contoh sementara untuk halaman Jurnal Ngajar.
//
// Backend belum ada di fase ini, jadi halaman memakai jadwal & murid tiruan.
// Saat task backend selesai, ganti pemanggilan fungsi di sini dengan service
// (`src/services/jurnal.service.ts`) dan API route (`/api/jurnal`) — bentuk
// `JurnalInput` di bawah sudah mengikuti tabel teaching_journals &
// journal_attendances di PRD, jadi kontraknya tidak perlu berubah.

import { tanggalISO } from "@/lib/tanggal";

export type MuridKelas = {
  id: string;
  nama: string;
};

export type Jadwal = {
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

const MURID_SD4: MuridKelas[] = [
  { id: "mrd-1", nama: "Aisyah Putri" },
  { id: "mrd-2", nama: "Bima Saputra" },
  { id: "mrd-3", nama: "Citra Ayu" },
  { id: "mrd-4", nama: "Dimas Pratama" },
];

const MURID_SMP7: MuridKelas[] = [
  { id: "mrd-5", nama: "Eka Lestari" },
  { id: "mrd-6", nama: "Fajar Nugroho" },
  { id: "mrd-7", nama: "Gita Permata" },
];

const MURID_SD6: MuridKelas[] = [
  { id: "mrd-8", nama: "Hana Salsabila" },
  { id: "mrd-9", nama: "Irfan Maulana" },
  { id: "mrd-10", nama: "Jihan Aulia" },
  { id: "mrd-11", nama: "Kevin Ardian" },
  { id: "mrd-12", nama: "Laras Widya" },
];

const MURID_SMP8: MuridKelas[] = [
  { id: "mrd-13", nama: "Made Surya" },
  { id: "mrd-14", nama: "Nadia Rahma" },
  { id: "mrd-15", nama: "Oskar Pratama" },
];

type JadwalMingguan = Omit<Jadwal, "id"> & { id: string; hari: string[] };

const JADWAL_MINGGUAN: JadwalMingguan[] = [
  {
    id: "jdw-1",
    kelasId: "kls-1",
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    hari: ["Senin", "Rabu", "Sabtu"],
    jamMulai: "07:00",
    jamSelesai: "08:30",
    murid: MURID_SD4,
  },
  {
    id: "jdw-2",
    kelasId: "kls-2",
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    hari: ["Selasa", "Kamis", "Sabtu"],
    jamMulai: "09:00",
    jamSelesai: "10:00",
    murid: MURID_SMP7,
  },
  {
    id: "jdw-3",
    kelasId: "kls-3",
    namaKelas: "IPA SD Kelas 6",
    cabang: "Cabang Utara",
    hari: ["Senin", "Rabu", "Jumat"],
    jamMulai: "10:30",
    jamSelesai: "12:00",
    murid: MURID_SD6,
  },
  {
    id: "jdw-4",
    kelasId: "kls-4",
    namaKelas: "Matematika SMP Kelas 8",
    cabang: "Cabang Utara",
    hari: ["Selasa", "Kamis", "Sabtu"],
    jamMulai: "13:00",
    jamSelesai: "14:30",
    murid: MURID_SMP8,
  },
  {
    id: "jdw-5",
    kelasId: "kls-5",
    namaKelas: "Calistung TK",
    cabang: "Cabang Pusat",
    hari: ["Senin", "Jumat"],
    jamMulai: "15:00",
    jamSelesai: "16:00",
    murid: MURID_SMP7.slice(0, 2),
  },
];

/**
 * Jadwal yang harus diisi guru pada satu hari. Di backend nanti fungsi ini
 * menjadi query ke tabel `schedules` yang difilter `hari` + `guru_id`.
 */
export function getJadwalHariIni(hari: string): Jadwal[] {
  return JADWAL_MINGGUAN.filter((item) => item.hari.includes(hari))
    .map((item) => ({
      id: item.id,
      kelasId: item.kelasId,
      namaKelas: item.namaKelas,
      cabang: item.cabang,
      jamMulai: item.jamMulai,
      jamSelesai: item.jamSelesai,
      murid: item.murid,
    }))
    .sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));
}

export type MuridJurnal = {
  id: string;
  nama: string;
  hadir: boolean;
  keterangan: string;
};

export type JurnalRiwayat = {
  id: string;
  tanggal: string;
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  jamMengajar: number;
  materi: string;
  catatan: string;
  status: "terkirim" | "direview";
  murid: MuridJurnal[];
};

export type KoreksiJurnal = {
  materi: string;
  catatan: string;
  kehadiran: KehadiranMurid[];
};

function kehadiranMurid(
  murid: MuridKelas[],
  absen: string[] = [],
  keterangan: Record<string, string> = {},
): MuridJurnal[] {
  return murid.map((anak) => ({
    ...anak,
    hadir: !absen.includes(anak.id),
    keterangan: absen.includes(anak.id) ? (keterangan[anak.id] ?? "") : "",
  }));
}

type RiwayatTersimpan = Omit<JurnalRiwayat, "tanggal"> & { hariLalu: number };

const RIWAYAT_JURNAL: RiwayatTersimpan[] = [
  {
    id: "jrn-6",
    hariLalu: 0,
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    jamMulai: "07:00",
    jamSelesai: "08:30",
    jamMengajar: 1.5,
    materi: "Latihan soal — pecahan campuran",
    catatan: "Dua murid perlu diulang materinya pekan depan.",
    status: "terkirim",
    murid: kehadiranMurid(MURID_SD4, ["mrd-3"], {
      "mrd-3": "Sakit, ada surat",
    }),
  },
  {
    id: "jrn-5",
    hariLalu: 2,
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    jamMulai: "09:00",
    jamSelesai: "10:00",
    jamMengajar: 1,
    materi: "Materi baru — simple past tense",
    catatan: "PR halaman 12 dikumpulkan pekan depan.",
    status: "direview",
    murid: kehadiranMurid(MURID_SMP7),
  },
  {
    id: "jrn-4",
    hariLalu: 3,
    namaKelas: "IPA SD Kelas 6",
    cabang: "Cabang Utara",
    jamMulai: "10:30",
    jamSelesai: "12:00",
    jamMengajar: 1.5,
    materi: "Pembahasan PR — rangkaian listrik",
    catatan: "",
    status: "terkirim",
    murid: kehadiranMurid(MURID_SD6, ["mrd-11"], { "mrd-11": "Izin lomba" }),
  },
  {
    id: "jrn-3",
    hariLalu: 4,
    namaKelas: "Matematika SMP Kelas 8",
    cabang: "Cabang Utara",
    jamMulai: "13:00",
    jamSelesai: "14:30",
    jamMengajar: 1.5,
    materi: "Kuis / evaluasi — persamaan linear",
    catatan: "Semua murid sudah paham.",
    status: "direview",
    murid: kehadiranMurid(MURID_SMP8),
  },
  {
    id: "jrn-2",
    hariLalu: 7,
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    jamMulai: "07:00",
    jamSelesai: "08:30",
    jamMengajar: 1.5,
    materi: "Lanjutan materi — perkalian bersusun",
    catatan: "",
    status: "direview",
    murid: kehadiranMurid(MURID_SD4),
  },
  {
    id: "jrn-1",
    hariLalu: 9,
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    jamMulai: "09:00",
    jamSelesai: "10:00",
    jamMengajar: 1,
    materi: "Ulangan — kosakata bab 2",
    catatan: "Nilai rata-rata 78.",
    status: "direview",
    murid: kehadiranMurid(MURID_SMP7, ["mrd-6"], { "mrd-6": "Demam" }),
  },
];

/** Saringan halaman riwayat: nama kelas dan rentang tanggal (YYYY-MM-DD). */
export type FilterRiwayat = {
  kelas: string;
  dari: string;
  sampai: string;
};

export const FILTER_RIWAYAT_KOSONG: FilterRiwayat = {
  kelas: "",
  dari: "",
  sampai: "",
};

/**
 * Jurnal yang pernah diisi guru, terbaru lebih dulu. Di backend nanti fungsi
 * ini menjadi query ke `teaching_journals` difilter `guru_id`, `tanggal`, dan
 * kelas — jadi saringannya dikerjakan di sini, bukan di tampilan.
 */
export function getRiwayatJurnal(
  filter: FilterRiwayat = FILTER_RIWAYAT_KOSONG,
): JurnalRiwayat[] {
  const hariIni = new Date();
  return RIWAYAT_JURNAL.map(({ hariLalu, ...jurnal }) => {
    const tanggal = new Date(hariIni);
    tanggal.setDate(tanggal.getDate() - hariLalu);
    return {
      ...jurnal,
      tanggal: tanggalISO(tanggal),
    };
  })
    .filter((jurnal) => !filter.kelas || jurnal.namaKelas === filter.kelas)
    .filter((jurnal) => !filter.dari || jurnal.tanggal >= filter.dari)
    .filter((jurnal) => !filter.sampai || jurnal.tanggal <= filter.sampai)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/**
 * Kelas yang punya jurnal, untuk pilihan pada saringan. Nanti ini menjadi
 * `SELECT DISTINCT` dari jurnal guru yang sedang masuk.
 */
export function getKelasRiwayat(): string[] {
  return [...new Set(RIWAYAT_JURNAL.map((jurnal) => jurnal.namaKelas))].sort(
    (a, b) => a.localeCompare(b, "id"),
  );
}

/** Satu jurnal lengkap dengan daftar muridnya, untuk halaman detail. */
export function getJurnalById(id: string): JurnalRiwayat | null {
  return getRiwayatJurnal().find((jurnal) => jurnal.id === id) ?? null;
}

/** Memisahkan materi tersimpan menjadi pilihan cepat + topik bebas. */
export function pisahMateri(materi: string) {
  const pemisah = " — ";
  const posisi = materi.indexOf(pemisah);
  const pilihan = posisi === -1 ? materi : materi.slice(0, posisi);
  const topik = posisi === -1 ? "" : materi.slice(posisi + pemisah.length);
  const dikenal = (PILIHAN_MATERI as readonly string[]).includes(pilihan);
  return dikenal ? { pilihan, topik } : { pilihan: "", topik: materi };
}

/** Pengganti sementara `PATCH /api/jurnal/[id]` untuk koreksi jurnal. */
export async function koreksiJurnalStub(koreksi: KoreksiJurnal) {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 500);
  await promise;
  return {
    ok: true as const,
    jumlahHadir: koreksi.kehadiran.filter((baris) => baris.hadir).length,
  };
}

/** Pilihan cepat materi supaya guru tidak perlu menulis panjang. */
export const PILIHAN_MATERI = [
  "Materi baru",
  "Lanjutan materi",
  "Latihan soal",
  "Pembahasan PR",
  "Kuis / evaluasi",
  "Ulangan",
] as const;

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
  return {
    ok: true as const,
    jumlahHadir: jurnal.kehadiran.filter((baris) => baris.hadir).length,
  };
}
