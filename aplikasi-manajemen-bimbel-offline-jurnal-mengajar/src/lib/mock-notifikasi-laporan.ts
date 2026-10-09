// Data tiruan untuk kartu notifikasi laporan bulanan.
//
// Komponen `KartuNotifikasiLaporanBulanan` memakai data ini sebagai pengganti
// sumber data dari tabel `notifications`. Saat endpoint notifikasi laporan
// bulanan siap, komponen cukup mengganti sumber datanya.

export type NotifikasiLaporanBulananTiruan = {
  id: string;
  tipe: "laporan_bulanan";
  pesan: string;
  sudahDibaca: boolean;
  createdAt: Date;
  /** Periode laporan dalam bentuk `YYYY-MM`. */
  periode: string;
  /** Ringkasan singkat isi laporan. */
  ringkasan: string;
};

const SEKARANG = new Date();

function hariLalu(jumlah: number) {
  const tanggal = new Date(SEKARANG);
  tanggal.setDate(tanggal.getDate() - jumlah);
  tanggal.setHours(8, 0, 0, 0);
  return tanggal;
}

/** Tiga notifikasi laporan bulanan tiruan: satu belum dibaca, dua sudah dibaca. */
export const NOTIFIKASI_LAPORAN_BULANAN_TIRUAN: NotifikasiLaporanBulananTiruan[] =
  [
    {
      id: "tiruan-laporan-1",
      tipe: "laporan_bulanan",
      pesan: "Laporan bulan Oktober 2026 sudah siap ditinjau.",
      sudahDibaca: false,
      createdAt: hariLalu(0),
      periode: "2026-10",
      ringkasan:
        "Pendapatan Rp12.500.000 dari 25 murid aktif. Pengeluaran operasional Rp4.200.000. Laba bersih Rp8.300.000.",
    },
    {
      id: "tiruan-laporan-2",
      tipe: "laporan_bulanan",
      pesan: "Laporan bulan September 2026 sudah siap ditinjau.",
      sudahDibaca: true,
      createdAt: hariLalu(30),
      periode: "2026-09",
      ringkasan:
        "Pendapatan Rp11.800.000 dari 23 murid aktif. Pengeluaran operasional Rp3.900.000. Laba bersih Rp7.900.000.",
    },
    {
      id: "tiruan-laporan-3",
      tipe: "laporan_bulanan",
      pesan: "Laporan bulan Agustus 2026 sudah siap ditinjau.",
      sudahDibaca: true,
      createdAt: hariLalu(61),
      periode: "2026-08",
      ringkasan:
        "Pendapatan Rp10.200.000 dari 20 murid aktif. Pengeluaran operasional Rp3.500.000. Laba bersih Rp6.700.000.",
    },
  ];