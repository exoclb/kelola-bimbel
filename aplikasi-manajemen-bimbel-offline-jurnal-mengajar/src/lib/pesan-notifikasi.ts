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
