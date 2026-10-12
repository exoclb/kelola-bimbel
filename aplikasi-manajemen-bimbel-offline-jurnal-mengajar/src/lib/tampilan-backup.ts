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
