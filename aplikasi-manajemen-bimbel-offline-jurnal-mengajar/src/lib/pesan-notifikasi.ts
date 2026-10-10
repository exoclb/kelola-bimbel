// Kalimat notifikasi yang baku. Dipisah dari layanan supaya pesannya tidak
// dirakit ulang di tiap pemanggil, bisa diuji tanpa basis data, dan gaya
// penulisannya seragam: setiap pesan honor selalu menyebut periode
// rekapitulasinya ("Juli 2097"), jadi penerima tahu notifikasi itu untuk bulan
// yang mana tanpa membuka halamannya lebih dulu.
import { formatPeriode, formatRupiah } from "@/lib/gaji";

/** Jam mengajar ditulis gaya Indonesia: `1.5` → `1,5`. */
function jamMengajar(totalJam: number) {
  return totalJam.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/**
 * Pesan untuk guru saat rekap honornya baru dicatat, mis.
 * "Rekap honor periode Juli 2097 sudah tersedia. Total Rp750.000 dari 15 jam
 * mengajar."
 */
export function pesanRekapHonor(
  periode: string,
  totalJam: number,
  totalGaji: number,
) {
  return `Rekap honor periode ${formatPeriode(periode)} sudah tersedia. Total ${formatRupiah(totalGaji)} dari ${jamMengajar(totalJam)} jam mengajar.`;
}

/**
 * Pesan untuk guru saat pembayaran honor satu periode ditandai, mis.
 * "Gaji Juli 2097 sebesar Rp750.000 sudah dibayar."
 */
export function pesanGajiDibayar(periode: string, totalGaji: number) {
  return `Gaji ${formatPeriode(periode)} sebesar ${formatRupiah(totalGaji)} sudah dibayar.`;
}

/**
 * Pesan untuk wali saat tagihan SPP anaknya diterbitkan, mis. "Tagihan SPP
 * Ani periode Juli 2097 sebesar Rp250.000 sudah terbit. Rinciannya bisa dibuka
 * di Portal Wali pada bagian Tagihan." Nama anak selalu disebut karena satu
 * akun wali bisa menautkan lebih dari satu anak.
 */
export function pesanTagihanTerbit(
  muridNama: string,
  periode: string,
  nominal: number,
) {
  return `Tagihan SPP ${muridNama} periode ${formatPeriode(periode)} sebesar ${formatRupiah(nominal)} sudah terbit. Rinciannya bisa dibuka di Portal Wali pada bagian Tagihan.`;
}

/**
 * Pesan untuk wali saat pembayaran tagihan anaknya ditandai lunas, mis.
 * "Pembayaran tagihan SPP Ani periode Juli 2097 sebesar Rp250.000 sudah
 * diterima." Periodenya ikut disebut supaya wali dengan lebih dari satu
 * tunggakan tahu tagihan mana yang sudah lunas.
 */
export function pesanTagihanLunas(
  muridNama: string,
  periode: string,
  nominal: number,
) {
  return `Pembayaran tagihan SPP ${muridNama} periode ${formatPeriode(periode)} sebesar ${formatRupiah(nominal)} sudah diterima. Bukti pembayarannya bisa dilihat di Portal Wali pada bagian Tagihan.`;
}

/** Angka ringkas laporan bulanan satu periode, dalam rupiah. */
export type AngkaLaporanBulanan = {
  /** Pemasukan periode, yaitu SPP yang sudah lunas. */
  pemasukan: number;
  /** Seluruh pengeluaran periode, termasuk honor guru. */
  pengeluaran: number;
  /** `pemasukan - pengeluaran`; negatif berarti rugi. */
  laba: number;
};

/**
 * Pesan laporan bulanan yang siap ditinjau, lengkap dengan ringkasan
 * pemasukan, pengeluaran, dan labanya, mis. "Laporan bulan Juli 2097 sudah
 * siap ditinjau. Pendapatan Rp5.000.000, pengeluaran Rp2.150.000, laba bersih
 * Rp2.850.000." Kalau labanya negatif, angkanya ditulis sebagai rugi bersih
 * tanpa tanda minus.
 */
export function pesanLaporanBulanan(
  periode: string,
  angka: AngkaLaporanBulanan,
) {
  const untung = angka.laba >= 0;
  return [
    `Laporan bulan ${formatPeriode(periode)} sudah siap ditinjau.`,
    `Pendapatan ${formatRupiah(angka.pemasukan)}, pengeluaran ${formatRupiah(angka.pengeluaran)}, ${untung ? "laba" : "rugi"} bersih ${formatRupiah(Math.abs(angka.laba))}.`,
  ].join(" ");
}
