// Data contoh Pengaturan Bimbel.
//
// Profil bimbel sudah punya tabelnya sendiri (`bimbel_profile`) dan halaman
// pengaturannya membaca basis data langsung; sisa berkas ini adalah data tiruan
// untuk bagian yang belum bermigrasi (tarif & skema gaji, daftar akun, dan
// preferensi notifikasi). Bentuk tiap bagian mengikuti kolom tabel yang sudah
// ada (tarif_per_jam, skema, berlaku_sejak, jenis_notifikasi, aktif,
// status_aktif) supaya nanti tinggal diganti sumbernya.
import { getDaftarAkun, type AkunMasuk } from "@/lib/mock-akun";
import { JENIS_NOTIFIKASI, type JenisNotifikasi } from "@/lib/notifikasi";

export type AturanGaji = {
  tarifPerJam: number;
  skema: string;
  berlakuSejak: string;
};

export type PreferensiNotifikasi = {
  jenis: JenisNotifikasi;
  keterangan: string;
  aktif: boolean;
};

// Riwayat tarif: yang dipakai untuk sebuah jurnal adalah baris terbaru yang
// `berlakuSejak`-nya tidak melewati tanggal jurnal itu, sama seperti aturan di
// tabel `salary_settings`.
const RIWAYAT_TARIF: AturanGaji[] = [
  { tarifPerJam: 50000, skema: "per jam", berlakuSejak: "2026-01-01" },
  { tarifPerJam: 60000, skema: "per jam", berlakuSejak: "2026-07-01" },
];

/** Riwayat tarif, yang terbaru lebih dulu. */
export function getRiwayatTarif(): AturanGaji[] {
  return [...RIWAYAT_TARIF].sort((a, b) =>
    b.berlakuSejak.localeCompare(a.berlakuSejak),
  );
}

/**
 * Tarif dan skema gaji yang berlaku sekarang (baris riwayat terbaru), atau
 * `undefined` kalau bimbelnya belum pernah mengatur tarif.
 */
export function getAturanGaji(): AturanGaji | undefined {
  const terbaru = getRiwayatTarif()[0];
  return terbaru ? { ...terbaru } : undefined;
}

/** Daftar akun guru dan owner beserta status aktifnya. */
export function getDaftarGuru(): AkunMasuk[] {
  return getDaftarAkun();
}

/** Preferensi notifikasi akun yang sedang masuk. */
export function getPreferensiNotifikasi(): PreferensiNotifikasi[] {
  // Daftar jenisnya baku di src/lib/notifikasi.ts; di sini hanya keadaannya
  // yang masih tiruan.
  return JENIS_NOTIFIKASI.map((item) => ({
    jenis: item.jenis,
    keterangan: item.keterangan,
    aktif: item.bawaanAktif,
  }));
}
