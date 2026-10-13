import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defineConfig,
  devices,
  type ReporterDescription,
} from "@playwright/test";

const testUrl = process.env.STARTER_TEST_DATABASE_URL;
if (!testUrl || !process.env.STARTER_TEST_RUN?.startsWith("starter-pg-test-")) {
  throw new Error(
    "Use npm run test:e2e so Playwright runs against its own disposable PostgreSQL server.",
  );
}
// Salinan uji ditulis ke direktori sementara, dan perintah dump-nya diganti
// perintah Node kecil yang menulis ke stdout — sama seperti `pg_dump -Fc` tanpa
// `-f` — supaya pemicu backup manual bisa diuji tanpa PostgreSQL client di PATH
// maupun ton dump sungguhan.
const testBackupDir = join(tmpdir(), `${process.env.STARTER_TEST_RUN}-backup`);
// Uji pemulihan menuntut database tujuan yang berbeda dari database aplikasi,
// jadi yang dipakai nama lain di server uji yang sama. Perintahnya diganti
// perintah Node kecil seperti perintah dump di atas: berguna untuk membuktikan
// endpointnya benar-benar menjalankan pemulihan, tanpa menuntut `pg_restore`
// terpasang di mesin uji.
//
// Perintah tiruan itu tidak benar-benar memulihkan apa pun, jadi database
// `kelola_restore` di sini memang tidak pernah ada. Itu disengaja: pemeriksaan
// isi hasil pemulihan harus melaporkan database percobaan yang tidak terbaca
// sebagai pemeriksaan yang gagal, bukan diam-diam dianggap lulus.
const testRestoreUrl = (() => {
  const url = new URL(testUrl);
  url.pathname = "/kelola_restore";
  return url.toString();
})();
// Laporan uji di CI dobel: `list` untuk log yang enak dibaca di halaman jalan,
// dan laporan HTML di `playwright-report` supaya yang gagal bisa ditelusuri dari
// artefaknya tanpa menjalankan ulang pipanya. `open: "never"` penting di runner
// yang tidak punya layar; kalau mau membukanya, unduh artefaknya dulu.
// Di komputer sendiri cukup `list` supaya keluarannya tidak berisik.
const perekaCI: ReporterDescription[] = [
  ["list"],
  ["html", { open: "never", outputFolder: "playwright-report" }],
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? perekaCI : "list",
  // Bukti kegagalan yang ikut diunggah sebagai artefak: potret layar saat uji
  // gagal, dan jejak langkahnya untuk ditelusuri di trace viewer — persis yang
  // dijanjikan saran kegagalan uji end-to-end di src/lib/ci-otomatis.ts.
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --port 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: "production",
      BETTER_AUTH_URL: "http://localhost:3101",
      DATABASE_URL: testUrl,
      MIGRATION_DATABASE_URL: testUrl,
      BACKUP_DIR: testBackupDir,
      // Dump tiruannya sengaja memakan waktu sesaat seperti dump sungguhan,
      // supaya keadaan "sedang berjalan" di tombol backup bisa diperiksa uji.
      BACKUP_COMMAND: `"${process.execPath}" -e "setTimeout(() => process.stdout.write('dump-uji-e2e'), 800)"`,
      RESTORE_DATABASE_URL: testRestoreUrl,
      RESTORE_COMMAND: `"${process.execPath}" -e "process.stdout.write('pulih-uji-e2e')" "{file}"`,
      // Penjadwal di dalam aplikasi dimatikan selama uji: kalau hidup, ia bisa
      // menjalankan backup di tengah uji dan mengacaukan jumlah serta urutan
      // catatan yang sedang diperiksa.
      PENJADWAL_BACKUP: "nonaktif",
    },
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
