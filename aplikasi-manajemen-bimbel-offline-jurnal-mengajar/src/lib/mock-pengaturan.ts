// Data contoh Pengaturan Bimbel.
//
// Tabel `salary_settings` (tarif & skema) dan `notification_preferences` sudah
// ada di database, tetapi profil bimbel belum punya tabelnya sendiri dan
// API pengaturannya belum dibuat. Jadi halaman ini memakai data tiruan dulu;
// bentuk tiap bagian mengikuti kolom tabel yang sudah ada (tarif_per_jam,
// skema, berlaku_sejak, jenis_notifikasi, aktif, status_aktif) supaya nanti
// tinggal diganti sumbernya.
import { getDaftarAkun, type AkunMasuk } from "@/lib/mock-akun";

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
  jenis: string;
  keterangan: string;
  aktif: boolean;
};

const PROFIL: ProfilBimbel = {
  nama: "Bimbel Cerdas Nusantara",
  alamat: "Jl. Melati No. 12, Bandung",
  telepon: "0812-3456-7890",
  email: "admin@cerdasnusantara.test",
};

const ATURAN_GAJI: AturanGaji = {
  tarifPerJam: 60000,
  skema: "per jam",
  berlakuSejak: "2026-07-01",
};

const PREFERENSI: PreferensiNotifikasi[] = [
  {
    jenis: "jurnal masuk",
    keterangan: "Ada guru mengirim jurnal mengajar.",
    aktif: true,
  },
  {
    jenis: "kelas kosong",
    keterangan: "Kelas hari ini belum diisi jurnalnya.",
    aktif: true,
  },
  {
    jenis: "gaji dibayar",
    keterangan: "Rekap gaji satu guru ditandai sudah dibayar.",
    aktif: true,
  },
  {
    jenis: "laporan bulanan",
    keterangan: "Ringkasan bimbel dikirim tiap awal bulan.",
    aktif: false,
  },
];

/** Profil bimbel yang dipakai laporan dan slip gaji. */
export function getProfilBimbel(): ProfilBimbel {
  return { ...PROFIL };
}

/** Tarif dan skema gaji yang berlaku sekarang. */
export function getAturanGaji(): AturanGaji {
  return { ...ATURAN_GAJI };
}

/** Daftar akun guru dan owner beserta status aktifnya. */
export function getDaftarGuru(): AkunMasuk[] {
  return getDaftarAkun();
}

/** Preferensi notifikasi akun yang sedang masuk. */
export function getPreferensiNotifikasi(): PreferensiNotifikasi[] {
  return PREFERENSI.map((preferensi) => ({ ...preferensi }));
}
