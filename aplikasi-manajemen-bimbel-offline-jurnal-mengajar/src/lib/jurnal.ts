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

/** Status kehadiran yang bisa dipilih guru untuk satu murid. */
export const STATUS_PRESENSI_MURID = [
  "hadir",
  "sakit",
  "izin",
  "alpa",
] as const;

export type StatusPresensiMurid = (typeof STATUS_PRESENSI_MURID)[number];

/** Alasan yang tersedia saat murid tidak hadir. */
export const ALASAN_TIDAK_HADIR = ["sakit", "izin", "alpa"] as const;

const LABEL_PRESENSI_MURID: Record<StatusPresensiMurid, string> = {
  hadir: "Hadir",
  sakit: "Sakit",
  izin: "Izin",
  alpa: "Alpa",
};

/** "hadir" → "Hadir", "izin" → "Izin". */
export function labelPresensiMurid(status: StatusPresensiMurid) {
  return LABEL_PRESENSI_MURID[status];
}

// Tabel `journal_attendances` masih menyimpan kehadiran sebagai `hadir` +
// `catatan` (batas 200 huruf), jadi alasan dititipkan di `catatan` dengan
// alasannya sebagai kata pertama — bentuk yang sama dengan yang dibaca Portal
// Wali saat menampilkan pertemuan yang tidak dihadiri. Dua fungsi di bawah
// adalah satu-satunya tempat bentuk itu diterjemahkan bolak-balik: kalau kelak
// tabelnya punya kolom status sendiri, cukup keduanya yang berubah.

/** Status + catatan bebas → nilai `catatan` yang dikirim ke `/api/jurnal`. */
export function catatanDariPresensi(
  status: StatusPresensiMurid,
  catatan: string,
) {
  if (status === "hadir") return "";
  const alasan = labelPresensiMurid(status);
  const tambahan = catatan.trim();
  return (tambahan ? `${alasan} — ${tambahan}` : alasan).slice(0, 200);
}

/**
 * Baris `journal_attendances` → status yang bisa ditampilkan di formulir.
 * Catatan yang tidak diawali alasan yang dikenal dibaca sebagai alpa dengan
 * catatan apa adanya, jadi tulisan lama tetap tampil apa yang ditulis guru.
 */
export function presensiDariCatatan(hadir: boolean, catatan: string) {
  const isi = catatan.trim();
  if (hadir) return { status: "hadir" as StatusPresensiMurid, catatan: "" };

  for (const alasan of ALASAN_TIDAK_HADIR) {
    const label = labelPresensiMurid(alasan);
    if (!isi.toLowerCase().startsWith(label.toLowerCase())) continue;
    // "Sakit — demam" → "demam"; "Sakit" → "" (tanpa alasan tambahan).
    const sisa = isi
      .slice(label.length)
      .replace(/^\s*[—–-]+\s*/, "")
      .trim();
    return { status: alasan as StatusPresensiMurid, catatan: sisa };
  }

  return { status: "alpa" as StatusPresensiMurid, catatan: isi };
}

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
