// Hitungan jam mengajar dipakai bersama oleh tampilan guru (form jurnal,
// konfirmasi, riwayat) dan pantauan owner, jadi tempatnya di sini — bukan di
// modul data contoh.

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
