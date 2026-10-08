// Pembantu format tanggal berbahasa Indonesia. Dipakai bersama oleh halaman
// jurnal, riwayat, dan fitur lain supaya tampilannya seragam.

/** Nama hari sesuai `Intl` id-ID, juga dipakai sebagai nilai kolom `hari`. */
export const HARI_DALAM_SEMINGGU = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
] as const;

export type NamaHari = (typeof HARI_DALAM_SEMINGGU)[number];

/** Tanggal lokal dalam bentuk `YYYY-MM-DD`. */
export function tanggalISO(tanggal: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tanggal);
}

/** Nama hari, misalnya "Sabtu". */
export function namaHari(tanggal: Date): NamaHari {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
  }).format(tanggal) as NamaHari;
}

/** Tanggal lengkap, misalnya "Sabtu, 3 Oktober 2026". */
export function formatTanggalLengkap(tanggal: Date | string) {
  const nilai =
    typeof tanggal === "string" ? new Date(`${tanggal}T00:00:00`) : tanggal;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(nilai);
}

/** Usia dalam tahun penuh pada hari ini, dihitung dari tanggal lahir. */
export function hitungUsia(tanggalLahir: string, sekarang = new Date()) {
  const lahir = new Date(`${tanggalLahir}T00:00:00`);
  let usia = sekarang.getFullYear() - lahir.getFullYear();
  const belumUlangTahun =
    sekarang.getMonth() < lahir.getMonth() ||
    (sekarang.getMonth() === lahir.getMonth() &&
      sekarang.getDate() < lahir.getDate());
  if (belumUlangTahun) usia -= 1;
  return usia;
}

/**
 * Urutan hari dalam seminggu (Senin lebih dulu), dipakai untuk menyusun daftar
 * jadwal. Urutan abjad akan menghasilkan Jumat–Kamis–Minggu, jadi hari
 * dibandingkan lewat indeks ini.
 */
export function indeksHari(nama: string) {
  const indeks = HARI_DALAM_SEMINGGU.indexOf(nama as NamaHari);
  return indeks === -1 ? HARI_DALAM_SEMINGGU.length : indeks;
}

/** Pembanding jadwal: hari (Senin–Minggu) lalu jam mulai. */
export function urutkanJadwal(
  a: { hari: string; jamMulai: string },
  b: { hari: string; jamMulai: string },
) {
  const bedaHari = indeksHari(a.hari) - indeksHari(b.hari);
  return bedaHari !== 0 ? bedaHari : a.jamMulai.localeCompare(b.jamMulai);
}

/**
 * Menit sejak tengah malam untuk jam `HH:MM`. Dipakai membandingkan jam sesi
 * dengan jam sekarang tanpa menyentuh tanggal.
 */
export function menitDariJam(jam: string) {
  const [jamKe, menit] = jam.split(":").map(Number);
  if (!Number.isFinite(jamKe) || !Number.isFinite(menit)) return null;
  return jamKe * 60 + menit;
}

/** Menit sejak tengah malam pada waktu tertentu (bawaan: sekarang). */
export function menitSekarang(tanggal = new Date()) {
  return tanggal.getHours() * 60 + tanggal.getMinutes();
}

/**
 * Lama satu sesi dari jam mulai dan jam selesai (`HH:MM`), mis. "1 jam 30
 * menit". String kosong dipakai bila jamnya tidak masuk akal (selesai sebelum
 * mulai), supaya tampilan tidak menampilkan angka negatif.
 */
export function durasiSesi(jamMulai: string, jamSelesai: string) {
  const [jam1, menit1] = jamMulai.split(":").map(Number);
  const [jam2, menit2] = jamSelesai.split(":").map(Number);
  const total = jam2 * 60 + menit2 - (jam1 * 60 + menit1);
  if (!Number.isFinite(total) || total <= 0) return "";

  const jam = Math.floor(total / 60);
  const menit = total % 60;
  return [jam > 0 ? `${jam} jam` : null, menit > 0 ? `${menit} menit` : null]
    .filter(Boolean)
    .join(" ");
}
