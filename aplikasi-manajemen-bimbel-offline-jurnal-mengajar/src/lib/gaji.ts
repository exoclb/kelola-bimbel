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

/**
 * Rekap satu guru pada satu periode untuk halaman riwayat per guru: berapa
 * jurnal, berapa jam, tarif yang berlaku saat itu, dan status pembayarannya.
 * Rincian tiap jurnalnya tidak ikut karena halaman ini membandingkan
 * bulan-bulan, bukan pertemuan.
 */
export type RingkasanGajiGuruPeriode = {
  periode: string;
  jumlahJurnal: number;
  totalJam: number;
  tarifPerJam: number;
  totalGaji: number;
  statusPembayaran: StatusPembayaran;
  tanggalDibayar: string | null;
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

/**
 * Batas tarif per jam yang boleh diisi, baik lewat formulir aturan gaji maupun
 * lewat API. Angkanya jauh di atas tarif bimbel mana pun, jadi yang ditahan
 * hanya salah ketik; tarif di atas ini akan membuat honor satu bulan tidak
 * masuk akal. `src/validators/pengaturan.ts` dan formulir aturan gaji memakai
 * konstanta yang sama ini supaya batas di layar dan batas yang ditegakkan
 * server tidak bisa berbeda.
 */
export const TARIF_MAKS = 10_000_000;

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
