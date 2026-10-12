// Halaman contoh (showcase) bawaan starter.
//
// Halaman-halaman ini acuan bentuk antarmuka saat pengembangan — bukan bagian
// aplikasi bimbel — jadi rute maupun tautannya tidak boleh ikut terlihat di
// penerapan rilis. Daftar dan saklarnya sengaja dikumpulkan di satu berkas
// supaya menu (`src/lib/mock-menu.ts`) dan penjaga rutenya memakai sumber yang
// sama: cukup satu tempat yang berubah saat saklar sungguhan datang.

/**
 * Rute halaman contoh, ditulis penuh seperti alamat di peramban. Menu memakai
 * daftar ini untuk tahu tautan mana yang termasuk contoh, dan penjaga rute
 * memakainya untuk menyembunyikan halamannya.
 */
export const HALAMAN_CONTOH = ["/app/contoh-status"] as const;

/**
 * Saklar halaman contoh — masih data tiruan.
 *
 * Nilai sungguhannya nanti dibaca dari pengaturan lingkungan rilis (task
 * "Saklar Mode Rilis"). Sementara itu penanda mode jalan yang sudah ada
 * dipakai lebih dulu: `npm run dev` membuka halaman contoh sebagai acuan
 * tampilan, sedangkan hasil rilis (`next build` + `next start`) menyembunyikan
 * tautan dan rutenya sekaligus — pengguna rilis tidak bisa tersesat ke sana
 * walau alamatnya diketik langsung.
 */
export function halamanContohAktif(
  sumber: NodeJS.ProcessEnv = process.env,
): boolean {
  return sumber.NODE_ENV !== "production";
}
