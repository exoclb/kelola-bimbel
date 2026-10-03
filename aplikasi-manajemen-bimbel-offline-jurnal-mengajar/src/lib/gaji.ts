// Hitungan dan format gaji. Angka tarif per jam nanti datang dari pengaturan
// bimbel, jadi perhitungannya dibuat di satu tempat ini.

/** "1200000" → "Rp1.200.000". */
export function formatRupiah(nilai: number) {
  return `Rp${nilai.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

/** Gaji = total jam mengajar × tarif per jam. */
export function hitungGaji(totalJam: number, tarifPerJam: number) {
  return Math.round(totalJam * tarifPerJam);
}

/** Periode bulan dalam bentuk `YYYY-MM` untuk bulan berjalan. */
export function periodeBulan(tanggal: Date) {
  return `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" → "Oktober 2026". */
export function formatPeriode(periode: string) {
  const [tahun, bulan] = periode.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(tahun, bulan - 1, 1));
}
