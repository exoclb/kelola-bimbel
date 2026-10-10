// Data contoh Pengaturan Bimbel.
//
// Profil bimbel sudah punya tabelnya sendiri (`bimbel_profile`) dan tarif honor
// disimpan di `salary_settings`; halaman pengaturannya membaca basis data
// langsung. Sisa berkas ini adalah data tiruan untuk bagian yang belum
// bermigrasi (daftar akun dan preferensi notifikasi). Bentuk tiap bagian
// mengikuti kolom tabel yang sudah ada (jenis_notifikasi, aktif, status_aktif)
// supaya nanti tinggal diganti sumbernya.
import { getDaftarAkun, type AkunMasuk } from "@/lib/mock-akun";
import { JENIS_NOTIFIKASI, type JenisNotifikasi } from "@/lib/notifikasi";

export type PreferensiNotifikasi = {
  jenis: JenisNotifikasi;
  keterangan: string;
  aktif: boolean;
};
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
