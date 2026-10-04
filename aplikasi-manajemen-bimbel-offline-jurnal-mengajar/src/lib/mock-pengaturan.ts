// Data contoh Pengaturan Bimbel.
//
// Tabel `salary_settings` (tarif & skema) dan `notification_preferences` sudah
// ada di database, tetapi profil bimbel belum punya tabelnya sendiri dan
// API pengaturannya belum dibuat. Jadi halaman ini memakai data tiruan dulu;
// bentuk tiap bagian mengikuti kolom tabel yang sudah ada (tarif_per_jam,
// skema, berlaku_sejak, jenis_notifikasi, aktif, status_aktif) supaya nanti
// tinggal diganti sumbernya.
import { getDaftarAkun, type AkunMasuk } from "@/lib/mock-akun";
import { JENIS_NOTIFIKASI, type JenisNotifikasi } from "@/lib/notifikasi";

export type ProfilBimbel = {
  nama: string;
  alamat: string;
  telepon: string;
  email: string;
};

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

const PROFIL: ProfilBimbel = {
  nama: "Bimbel Cerdas Nusantara",
  alamat: "Jl. Melati No. 12, Bandung",
  telepon: "0812-3456-7890",
  email: "admin@cerdasnusantara.test",
};

// Riwayat tarif: yang dipakai untuk sebuah jurnal adalah baris terbaru yang
// `berlakuSejak`-nya tidak melewati tanggal jurnal itu, sama seperti aturan di
// tabel `salary_settings`.
const RIWAYAT_TARIF: AturanGaji[] = [
  { tarifPerJam: 50000, skema: "per jam", berlakuSejak: "2026-01-01" },
  { tarifPerJam: 60000, skema: "per jam", berlakuSejak: "2026-07-01" },
];

/** Profil bimbel yang dipakai laporan dan slip gaji. */
export function getProfilBimbel(): ProfilBimbel {
  return { ...PROFIL };
}

/** Riwayat tarif, yang terbaru lebih dulu. */
export function getRiwayatTarif(): AturanGaji[] {
  return [...RIWAYAT_TARIF].sort((a, b) =>
    b.berlakuSejak.localeCompare(a.berlakuSejak),
  );
}

/** Tarif dan skema gaji yang berlaku sekarang (baris riwayat terbaru). */
export function getAturanGaji(): AturanGaji {
  return { ...getRiwayatTarif()[0]! };
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
