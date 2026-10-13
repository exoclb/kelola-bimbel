# Local development database

Open this folder in your AI editor and describe the app you want:

> Build a personal reading list with accounts. Set up this project, run it, and let each person manage their own books.

`AGENTS.md` tells the agent to handle setup before continuing your feature. `agent.md` points to the same instructions. The project skills provide setup, database troubleshooting, feature-building, and derivative workflows.

## What runs where

`compose.dev.yaml` runs PostgreSQL 17. Next.js runs on your computer for normal development and hot reload. You need Node.js 22.12+ and Docker with Compose v2; Docker Desktop includes both the engine and Compose.

```sh
npm run setup
npm run dev
```

Setup installs pinned dependencies, generates missing private settings in ignored `.env.local`, chooses a free database port, creates a unique Compose project and persistent volume, waits for PostgreSQL health, applies committed Drizzle migrations, and checks the result. It can be repeated without changing credentials or deleting records. If Docker is not running, the script gives a specific message; start Docker and retry.

The agent can use `npm run predev` then `npm run doctor` when dependencies already exist. `npm run dev` also runs preparation automatically. If the browser uses a different port, `BETTER_AUTH_URL` must match the actual app origin. Database and app ports are separate.

## Database commands

| Command                  | Result                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run db:up`          | Generate missing local settings and start PostgreSQL; wait until healthy                                                                                     |
| `npm run db:status`      | Show this copy's running or stopped database container                                                                                                       |
| `npm run db:logs`        | Show the last 80 database log lines without following indefinitely                                                                                           |
| `npm run db:down`        | Remove this copy's container and network, keeping its data volume                                                                                            |
| `npm run db:migrate`     | Apply committed migrations                                                                                                                                   |
| `npm run db:seed`        | Create the first owner account; idempotent, needs `SEED_OWNER_PASSWORD`                                                                                      |
| `npm run db:seed:wali`   | Link the example wali accounts to their children (`students` + `wali_murid`); idempotent, needs `SEED_WALI_PASSWORD` while any wali account is still missing |
| `npm run db:seed:cabang` | Fill the example branches in `cabang`; idempotent, never overwrites existing rows, development only                                                          |
| `npm run db:seed:kelas`  | Fill the example classes in `classes`, pointing at those branches (run `db:seed:cabang` first); idempotent, development only                                 |
| `npm run db:seed:contoh` | Fill the example branches and classes in the right order (`cabang` then `classes`); idempotent, development only                                             |
| `npm run doctor`         | Verify connection, auth tables, and project tooling files; note whether an example branch still has to be seeded with `npm run db:seed:cabang`               |

Tes unit (`npm test`) dijalankan dengan `--conditions=react-server`, jadi modul ber-`server-only` seperti layanan di `src/services/` dan `src/db/` bisa diuji langsung tanpa peramban — contohnya `tests/cabang-service.test.mjs`. Pemeriksaan rantai migrasi ada di `npx drizzle-kit check`.

`npm run check` menjalankan lint, pemeriksaan tipe, dan uji unit sekaligus; itulah perintah yang dipakai pipa CI bersama `npm run setup`, `npm run format:check`, `npm run build`, dan `npm run test:e2e`.

Pipa itu berjalan di GitHub Actions (`.github/workflows/ci.yml`) pada setiap push dan pull request dalam tiga job: `check` (lint, tipe, uji unit, format), `e2e` (build produksi lalu skenario peramban, dan hanya jalan kalau `check` lulus), dan `ringkasan` yang menuliskan tabel hasil kelima langkah ke halaman jalan lalu menggagalkan pipa kalau ada job yang tidak lulus. Keduanya memakai PostgreSQL sekali pakai yang sama dengan uji lokal. Berkas pipanya sengaja ada di akar repo, bukan di dalam folder aplikasi: GitHub hanya membaca `.github/workflows` pada akar repo, jadi pipa yang disimpan di subfolder tidak pernah dijalankan. Karena itu semua perintah aplikasinya dijalankan lewat `defaults.run.working-directory: aplikasi-manajemen-bimbel-offline-jurnal-mengajar`, sedangkan rujukan berkas di luar `run:` (`.nvmrc`, `package-lock.json`, laporan uji) memakai awalan folder aplikasi.

Setelah pipanya benar-benar melapor, hasilnya bisa dijadikan syarat merge di cabang utama: `npm run ci:wajib` menyetel branch protection GitHub supaya status check satu-satunya yang selalu melapor — job `ringkasan` (`Ringkasan hasil CI`) — harus lulus sebelum digabung. Nama check-nya dibaca dari berkas pipanya sendiri, jadi tidak bisa melenceng; `--kering` hanya mencetak perintah `gh api`-nya, dan `--hapus` mencabut kewajibannya lagi. Yang dibutuhkan cuma GitHub CLI yang sudah `gh auth login` dan hak admin di reponya — tetapi branch protection sendiri hanya tersedia di repo publik atau GitHub Pro, jadi repo privat pada paket gratis dijawab 403 dan pesannya diteruskan apa adanya. Setelannya hanya menambah kewajiban itu (`enforce_admins: false`), tidak mengubah aturan lain, dan karena status check diwajibkan, cabang yang dilindungi tidak bisa lagi di-push langsung — perubahannya masuk lewat pull request.

Yang diunduh tidak diunduh ulang setiap jalan: `setup-node` menyimpan cache npm dari `package-lock.json`, dan job peramban menyimpan peramban Playwright di `~/.cache/ms-playwright`. Kalau ada langkah yang gagal, hasil uji peramban disimpan 7 hari sebagai artefak `laporan-uji-peramban`: `test-results` berisi tangkapan layar dan jejak langkah (trace), `playwright-report` berisi laporan HTML yang bisa dibuka langsung dari artefaknya. Laporan HTML itu ditulis hanya saat ujinya berjalan di CI (`playwright.config.ts` menambah perekanya kalau `CI` terpasang); di komputer sendiri cukup keluarannya `list`. Daftar langkahnya sengaja sama dengan `PEMERIKSAAN_CI` di `src/lib/ci-otomatis.ts`, yang dibacakan halaman Pengaturan → Status CI.

Use these commands instead of bare `docker compose up`: the wrappers load Next.js environment files and the saved project name. The database listens only on `127.0.0.1`, using a generated high port recorded in `.env.local`. Each fresh derivative has its own project, password, port, and volume.

Preserve `.env.local` across restarts. Do not delete the volume to fix a password or migration error. If a saved port becomes occupied, update both `POSTGRES_PORT` and the port in the managed `DATABASE_URL`, then run `db:up` again. Changing the environment password does not change an existing database role's password.

## Existing PostgreSQL connections

If you set `DATABASE_URL` before setup, the script keeps it and skips Docker. Use a database dedicated to your app. `MIGRATION_DATABASE_URL` is optional for a separate direct connection. The local container status/log/stop commands do not operate on external databases; use `npm run doctor` to check their connection.

## Verify a fresh start

```sh
npm run test:setup
```

This integration check creates a temporary source copy with no dependencies or environment file, runs setup, stores a marker, repeats setup, recreates the database container, and confirms the marker survived. It removes only its own temporary copy and generated Docker volume. Docker and package registry access are required. The main project's environment and database are never used.
