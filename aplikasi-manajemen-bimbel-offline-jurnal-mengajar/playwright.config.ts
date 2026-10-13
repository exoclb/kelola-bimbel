import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

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
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3101", trace: "retain-on-failure" },
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
      // Penjadwal di dalam aplikasi dimatikan selama uji: kalau hidup, ia bisa
      // menjalankan backup di tengah uji dan mengacaukan jumlah serta urutan
      // catatan yang sedang diperiksa.
      PENJADWAL_BACKUP: "nonaktif",
    },
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
