// Data contoh pengeluaran operasional bimbel.
//
// Tabel `expense_categories` dan `expenses` belum ada, jadi daftarnya masih
// tiruan. Bentuk datanya mengikuti rencana kolomnya (kategori, nominal,
// tanggal, catatan, jejak waktu), sehingga nanti tinggal diganti sumbernya.

import type { KategoriPengeluaran, Pengeluaran } from "@/lib/pengeluaran";
import { tanggalISO } from "@/lib/tanggal";

const KATEGORI: KategoriPengeluaran[] = [
  { id: "kat-sewa", nama: "Sewa" },
  { id: "kat-listrik", nama: "Listrik & Air" },
  { id: "kat-atk", nama: "Alat Tulis" },
  { id: "kat-pemeliharaan", nama: "Pemeliharaan" },
  { id: "kat-internet", nama: "Internet" },
];

type PengeluaranTersimpan = {
  kategoriId: string;
  nominal: number;
  catatan: string;
  /** 0 = hari ini, 35 = 35 hari lalu, dan seterusnya. */
  hariLalu: number;
};

const CATATAN_KATEGORI: Record<string, string> = {
  "kat-sewa": "Sewa ruko bulanan",
  "kat-listrik": "Tagihan listrik dan air",
  "kat-atk": "Beli spidol, buku tulis, dan kertas",
  "kat-pemeliharaan": "Servis AC dan perbaikan meja",
  "kat-internet": "Tagihan internet bulanan",
};

const PENGELUARAN: PengeluaranTersimpan[] = [
  // Bulan berjalan (contoh dibuat mendekati awal bulan).
  { kategoriId: "kat-atk", nominal: 180000, catatan: "", hariLalu: 1 },
  { kategoriId: "kat-listrik", nominal: 475000, catatan: "", hariLalu: 2 },
  { kategoriId: "kat-internet", nominal: 350000, catatan: "", hariLalu: 4 },
  { kategoriId: "kat-sewa", nominal: 2500000, catatan: "", hariLalu: 5 },
  {
    kategoriId: "kat-pemeliharaan",
    nominal: 650000,
    catatan: "",
    hariLalu: 11,
  },
  // Bulan-bulan sebelumnya, untuk saringan periode dan laporan.
  {
    kategoriId: "kat-atk",
    nominal: 95000,
    catatan: "Beli penghapus papan",
    hariLalu: 34,
  },
  { kategoriId: "kat-listrik", nominal: 512000, catatan: "", hariLalu: 36 },
  { kategoriId: "kat-sewa", nominal: 2500000, catatan: "", hariLalu: 40 },
  {
    kategoriId: "kat-pemeliharaan",
    nominal: 320000,
    catatan: "Ganti lampu kelas",
    hariLalu: 56,
  },
  { kategoriId: "kat-internet", nominal: 350000, catatan: "", hariLalu: 61 },
  { kategoriId: "kat-atk", nominal: 210000, catatan: "", hariLalu: 68 },
  { kategoriId: "kat-sewa", nominal: 2500000, catatan: "", hariLalu: 70 },
];

/** Semua pengeluaran contoh, terbaru lebih dulu. */
export function getSemuaPengeluaran(): Pengeluaran[] {
  const hariIni = new Date();
  return PENGELUARAN.map((baris, urutan) => {
    const tanggal = new Date(hariIni);
    tanggal.setDate(tanggal.getDate() - baris.hariLalu);
    const kategori = KATEGORI.find((item) => item.id === baris.kategoriId);
    return {
      id: `exp-${PENGELUARAN.length - urutan}`,
      kategoriId: baris.kategoriId,
      kategoriNama: kategori?.nama ?? "Lain-lain",
      nominal: baris.nominal,
      tanggal: tanggalISO(tanggal),
      catatan: baris.catatan || (CATATAN_KATEGORI[baris.kategoriId] ?? ""),
    };
  }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
}

/** Kategori pengeluaran yang tersedia, untuk pilihan pada form dan saringan. */
export function getKategoriPengeluaran(): KategoriPengeluaran[] {
  return KATEGORI.map((baris) => ({ ...baris }));
}
