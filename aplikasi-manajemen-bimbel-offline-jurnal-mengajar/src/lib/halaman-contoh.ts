// Halaman contoh (showcase) bawaan starter.
//
// Halaman-halaman ini acuan bentuk antarmuka saat pengembangan — bukan bagian
// aplikasi bimbel — jadi rute maupun tautannya tidak boleh ikut terlihat di
// penerapan rilis. Daftar dan saklarnya sengaja dikumpulkan di satu berkas
// supaya menu (`src/lib/mock-menu.ts`) dan penjaga rutenya memakai sumber yang
// sama: cukup satu tempat yang berubah kalau daftarnya bergeser.
import { modeRilisAktif } from "@/lib/mode-rilis";

/**
 * Rute halaman contoh, ditulis penuh seperti alamat di peramban. Menu memakai
 * daftar ini untuk tahu tautan mana yang termasuk contoh, dan penjaga rute
 * memakainya untuk menyembunyikan halamannya.
 */
export const HALAMAN_CONTOH = ["/app/contoh-status"] as const;

/**
 * Saklar halaman contoh: menyala berarti halaman contoh (beserta tautan
 * menunya) terjangkau.
 *
 * Nilainya ditentukan `src/lib/mode-rilis.ts` dari variabel `MODE_RILIS`, dan
 * mengikuti `NODE_ENV` kalau variabel itu kosong — jadi `npm run dev` membuka
 * halaman contoh sebagai acuan tampilan, sedangkan hasil rilis
 * (`next build` + `next start`) menyembunyikan tautan dan rutenya sekaligus:
 * pengguna rilis tidak bisa tersesat ke sana walau alamatnya diketik langsung.
 * Operator bisa memaksa keadaan salah satunya lewat `MODE_RILIS` tanpa
 * mengubah mode build (mis. `MODE_RILIS=false` saat meninjau hasil rilis).
 */
export function halamanContohAktif(
  sumber: NodeJS.ProcessEnv = process.env,
): boolean {
  return !modeRilisAktif(sumber);
}
