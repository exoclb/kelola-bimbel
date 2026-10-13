/**
 * Titik masuk server Next.js (`instrumentation.ts`): dipanggil sekali saat
 * proses server mulai. Di sini penjadwal backup otomatis dinyalakan — lihat
 * `src/services/penjadwal-backup.service.ts` untuk aturan jatuh temponya.
 *
 * Dua penjagaan sebelum menyalakannya:
 * - `NEXT_RUNTIME` harus `nodejs`; di runtime edge tidak ada proses maupun
 *   akses berkas, jadi penjadwalnya tidak mungkin jalan.
 * - Tahap `next build` juga memanggil berkas ini, dan `NODE_ENV` saat itu sudah
 *   `production`. Tanpa penjagaan `NEXT_PHASE`, proses build bisa menjalankan
 *   dump database sungguhan. Saat build, penjadwalnya dilewati.
 *
 * Mematikan penjadwalnya (mis. karena operator memakai cron sendiri) cukup
 * dengan `PENJADWAL_BACKUP=nonaktif`; keputusannya ada di layanannya, bukan di
 * sini, supaya perilakunya bisa diuji tanpa menyalakan server.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { mulaiPenjadwalBackup } =
    await import("@/services/penjadwal-backup.service");
  mulaiPenjadwalBackup();
}
