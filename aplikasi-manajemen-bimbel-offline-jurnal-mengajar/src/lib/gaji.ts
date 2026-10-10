// Hitungan, format, dan bentuk data gaji. Tarif per jam datang dari pengaturan
// bimbel, jadi perhitungannya dibuat di satu tempat ini.
//
// Tipe di bawah adalah kontrak antara layanan gaji (`src/services/gaji.service.ts`)
// dan komponen halaman: komponen hanya butuh bentuk datanya, bukan koneksi
// basis datanya, jadi tipenya tinggal di modul murni ini.

export type StatusPembayaran = "belum_dibayar" | "dibayar";

/** Satu jurnal yang ikut dihitung ke honor: kapan, kelas apa, berapa jam. */
export type RincianJam = {
  tanggal: string;
  namaKelas: string;
  jamMengajar: number;
  jumlahHadir: number;
  jumlahMurid: number;
};

/** Rekap satu guru pada satu periode, lengkap dengan status pembayarannya. */
export type BarisRekapGaji = {
  guruId: string;
  guruNama: string;
  guruEmail: string;
  jumlahJurnal: number;
  totalJam: number;
  tarifPerJam: number;
  totalGaji: number;
  statusPembayaran: StatusPembayaran;
  tanggalDibayar: string | null;
  rincian: RincianJam[];
};

/** Rekap honor semua guru pada satu periode (`YYYY-MM`). */
export type RekapGaji = {
  periode: string;
  tarifPerJam: number;
  /** `false` kalau belum ada aturan tarif yang berlaku untuk periode itu. */
  tarifDiatur: boolean;
  daftar: BarisRekapGaji[];
};

/** Ringkasan satu periode untuk halaman riwayat gaji. */
export type RingkasanGajiBulanan = {
  periode: string;
  jumlahGuru: number;
  totalJam: number;
  totalGaji: number;
  jumlahDibayar: number;
};

/** "1200000" → "Rp1.200.000". */
export function formatRupiah(nilai: number) {
  return `Rp${nilai.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

/** Satu aturan tarif honor (tabel `salary_settings`). */
export type AturanTarif = {
  id: string;
  tarifPerJam: number;
  skema: string;
  berlakuSejak: string;
};

/**
 * Aturan tarif yang dipakai pada satu tanggal: baris terbaru yang
 * `berlakuSejak`-nya tidak melewati tanggal itu. `pengaturan` harus urut dari
 * yang paling baru, dan tanggal bertipe teks `YYYY-MM-DD` supaya bisa
 * dibandingkan apa adanya. Dipakai server saat menghitung rekap (`aturanGajiBerlaku`)
 * maupun layar pengaturan yang menandai tarif mana yang sedang berlaku.
 */
export function aturanTarifBerlaku<T extends { berlakuSejak: string }>(
  pengaturan: T[],
  tanggal: string,
): T | null {
  return pengaturan.find((baris) => baris.berlakuSejak <= tanggal) ?? null;
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
