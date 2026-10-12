// Pembantu tampilan modul backup, dipakai halaman Pengaturan → Backup Database
// dan komponen daftar riwayatnya. Dipisah dari komponen supaya format waktunya
// bisa diuji tanpa peramban, sekaligus menjaga kartu ringkasan dan daftar
// riwayat menulis ukuran serta lama prosesnya dengan cara yang sama.

/** Waktu lengkap berbahasa Indonesia, mis. "13 Oktober 2026 pukul 17.00". */
export const waktuLengkap = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
});

/** Lama satu proses backup, mis. "1 menit 12 detik"; null berarti belum selesai. */
export function lamaProses(mulai: Date, selesai: Date | null) {
  if (!selesai) return null;
  const detik = Math.max(
    0,
    Math.round((selesai.getTime() - mulai.getTime()) / 1000),
  );
  if (detik < 60) return `${detik} detik`;
  const menit = Math.floor(detik / 60);
  const sisaDetik = detik % 60;
  return sisaDetik === 0
    ? `${menit} menit`
    : `${menit} menit ${sisaDetik} detik`;
}

/** Ukuran berkas backup dalam satuan yang mudah dibaca; "—" kalau belum ada. */
export function ukuranTeks(byte: number | null) {
  if (!byte) return "—";
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(1)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

/** Umur sebuah salinan, mis. "hari ini", "kemarin", atau "3 hari lalu". */
export function umurBackup(waktu: Date, sekarang = new Date()) {
  const hari = Math.floor(
    (sekarang.getTime() - waktu.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (hari <= 0) return "hari ini";
  if (hari === 1) return "kemarin";
  return `${hari} hari lalu`;
}

/**
 * Tenggang sebelum salinan terakhir dianggap terlambat, dihitung dari jeda
 * jadwalnya. Backup yang mulai sedikit telat — prosesnya bisa berjalan lama —
 * belum tentu penjadwalnya rusak, jadi tidak langsung dicurigai.
 */
const TENGGANG_JAM = 2;

export type KesegaranBackup = {
  tingkat: "segar" | "terlambat" | "kadaluarsa";
  /** Label pendek yang ditampilkan sebagai nilai rinciannya. */
  label: string;
  /** Satu kalimat penjelas: apa arti label itu bagi pemilik bimbel. */
  keterangan: string;
};

/**
 * Menilai kesegaran backup terakhir yang berhasil terhadap jadwalnya: masih
 * dalam tenggang jadwal, terlambat, atau sudah lewat retensi sehingga berkasnya
 * mungkin sudah dihapus penjadwal. Dipakai kartu ringkasan backup terakhir;
 * `jedaJam` 24 berarti jadwalnya harian.
 */
export function kesegaranBackup(
  mulai: Date,
  { jedaJam, retensiHari }: { jedaJam: number; retensiHari: number },
  sekarang = new Date(),
): KesegaranBackup {
  const umurJam = (sekarang.getTime() - mulai.getTime()) / (60 * 60 * 1000);
  if (umurJam > retensiHari * 24)
    return {
      tingkat: "kadaluarsa",
      label: "Lewat retensi",
      keterangan: `Salinan inilah yang terakhir berhasil, dan umurnya sudah lewat retensi ${retensiHari} hari — berkasnya mungkin sudah dihapus penjadwal.`,
    };
  if (umurJam > jedaJam + TENGGANG_JAM)
    return {
      tingkat: "terlambat",
      label: "Terlambat",
      keterangan:
        "Jadwal berikutnya seharusnya sudah membuat salinan baru. Periksa penjadwal dan log backup di server.",
    };
  return {
    tingkat: "segar",
    label: "Sesuai jadwal",
    keterangan:
      "Salinan terbaru masih dalam tenggang jadwal, jadi backup berjalan seperti seharusnya.",
  };
}
