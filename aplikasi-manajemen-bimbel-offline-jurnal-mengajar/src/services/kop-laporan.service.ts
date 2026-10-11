import "server-only";
import { NAMA_BIMBEL_CADANGAN, type ProfilDokumen } from "@/lib/dokumen-html";
import { ambilProfilBimbel } from "@/services/pengaturan.service";

/**
 * Identitas bimbel untuk kop laporan, dibaca dari profil yang tersimpan.
 *
 * Layar pengaturan mengirim profilnya apa adanya (formnya harus bisa
 * menyunting nilai yang benar-benar tersimpan), sedangkan semua tempat yang
 * mencetak dokumen — rekap gaji, slip, bukti tagihan, laporan arus kas, laba
 * rugi, dan laporan perkembangan — cuma perlu identitas untuk kop. Layanan ini
 * jadi satu-satunya jalur untuk keperluan itu, supaya tiap halaman tidak perlu
 * tahu bentuk tabelnya dan tidak ada kop yang dirakit dari nilai bawaan
 * komponen.
 *
 * Hasilnya selalu terisi: kalau barisnya belum pernah dibuat, kolom kosongnya
 * tetap teks kosong dan namanya jatuh ke `NAMA_BIMBEL_CADANGAN`, jadi dokumen
 * yang dicetak tidak pernah muncul tanpa identitas penerbit. Nilai tepinya
 * dipangkas di sini karena kolom teks bebas bisa diisi spasi saja, dan
 * pemangkasan itu sudah jadi aturan kop (`namaProfilDokumen`,
 * `kontakProfilDokumen`).
 */
export async function ambilKopLaporan(): Promise<ProfilDokumen> {
  const profil = await ambilProfilBimbel();
  const nama = profil.nama.trim();
  return {
    nama: nama || NAMA_BIMBEL_CADANGAN,
    alamat: profil.alamat.trim(),
    telepon: profil.telepon.trim(),
    email: profil.email.trim(),
    logo: profil.logo ?? null,
  };
}
