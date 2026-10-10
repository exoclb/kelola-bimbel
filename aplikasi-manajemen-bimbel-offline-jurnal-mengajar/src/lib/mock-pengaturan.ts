// Data contoh Pengaturan Bimbel.
//
// Profil bimbel sudah punya tabelnya sendiri (`bimbel_profile`), tarif honor
// disimpan di `salary_settings`, dan preferensi notifikasi dibaca dari tabel
// `notification_preferences`; halaman pengaturannya membaca basis data
// langsung. Sisa berkas ini adalah data tiruan untuk bagian yang belum
// bermigrasi: daftar akun guru (padanannya `src/services/pengaturan.service.ts`
// lewat `/api/pengaturan/guru`).
import { getDaftarAkun, type AkunMasuk } from "@/lib/mock-akun";

/** Daftar akun guru dan owner beserta status aktifnya. */
export function getDaftarGuru(): AkunMasuk[] {
  return getDaftarAkun();
}
