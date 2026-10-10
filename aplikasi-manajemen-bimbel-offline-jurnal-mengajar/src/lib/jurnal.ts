// Bentuk data, hitungan, dan pilihan yang dipakai bersama tampilan jurnal:
// formulir guru, konfirmasi, halaman riwayat, dan pantauan owner. Isinya tipe
// dan fungsi murni tanpa data contoh, jadi aman dipakai di server maupun
// peramban.

/** Murid yang bisa dicatat kehadirannya pada satu sesi mengajar. */
export type MuridKelas = {
  id: string;
  nama: string;
};

/** Satu sesi mengajar hari ini yang bisa diisi jurnalnya. */
export type Jadwal = {
  id: string;
  kelasId: string;
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  murid: MuridKelas[];
};

/** Kehadiran satu murid pada jurnal yang dikirim. */
export type KehadiranMurid = {
  muridId: string;
  hadir: boolean;
  catatan: string;
};

/** Isi `POST /api/jurnal`. Kelas, tanggal, dan jam mengajar diisi server dari jadwal. */
export type JurnalInput = {
  jadwalId: string;
  materi: string;
  catatan: string;
  kehadiran: KehadiranMurid[];
};

/** Selisih jam mulai dan jam selesai ("07:00" → "08:30" = 1,5). */
export function hitungJamMengajar(jamMulai: string, jamSelesai: string) {
  const [jamAwal, menitAwal] = jamMulai.split(":").map(Number);
  const [jamAkhir, menitAkhir] = jamSelesai.split(":").map(Number);
  const selisihMenit = jamAkhir * 60 + menitAkhir - (jamAwal * 60 + menitAwal);
  return Math.round((selisihMenit / 60) * 10) / 10;
}

/** "1.5" → "1,5 jam" (pemisah desimal khas Indonesia). */
export function formatJam(nilai: number) {
  return `${nilai.toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
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

/** Memisahkan materi tersimpan menjadi pilihan cepat + topik bebas. */
export function pisahMateri(materi: string) {
  const pemisah = " — ";
  const posisi = materi.indexOf(pemisah);
  const pilihan = posisi === -1 ? materi : materi.slice(0, posisi);
  const topik = posisi === -1 ? "" : materi.slice(posisi + pemisah.length);
  const dikenal = (PILIHAN_MATERI as readonly string[]).includes(pilihan);
  return dikenal ? { pilihan, topik } : { pilihan: "", topik: materi };
}
