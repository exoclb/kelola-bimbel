# Deploy Produksi ke Coolify

Panduan langkah deploy dari nol sampai aplikasi live, ditulis mengikuti fase rilis
agar bisa diikuti ulang oleh siapa pun. Setiap fase boleh dijalankan terpisah dan
aman diulang.

Aturan pokok: **tidak ada nilai rahasia di repo**. Semua nilai sensitif
(`DATABASE_URL`, `BETTER_AUTH_SECRET`, sandi database) hanya disimpan di
pengelola secret Coolify.

Daftar isi: [Fase 1 — Basis Data](#fase-1--basis-data-produksi) ·
[Fase 2 — Rahasia & Deploy Aplikasi](#fase-2--rahasia--deploy-aplikasi-dari-dockerfile) ·
[Fase 3 — Migrasi Otomatis & Domain/HTTPS](#fase-3--migrasi-otomatis--domainhttps) ·
[Fase 4 — Auto-deploy & Backup](#fase-4--auto-deploy-dari-git--backup-database) ·
[Fase 5 — Uji Go-live](#fase-5--panduan--uji-coba-go-live) ·
[Checklist singkat](#checklist-singkat) ·
[Masalah yang sering muncul](#masalah-yang-sering-muncul)

## Fase 1 — Basis Data Produksi

### 1. Membuat resource PostgreSQL 17

Database produksi adalah **resource terkelola di Coolify**, bukan instalasi
manual di server. Dua cara:

**a. Lewat skrip (disarankan, idempoten)**

Skrip `scripts/coolify-db.mjs` memanggil API Coolify, jadi butuh URL + token
instance. Nilai-nilainya diberikan hanya untuk perintah itu, tidak ditulis ke
berkas mana pun:

```bash
COOLIFY_URL=https://coolify.contoh.com \
COOLIFY_TOKEN=<token API> \
COOLIFY_SERVER_UUID=<uuid server> \
COOLIFY_PROJECT_UUID=<uuid project> \
npm run coolify:db -- buat
```

Env opsional: `COOLIFY_ENVIRONMENT` (bawaan `production`), `COOLIFY_DB_NAME`
(bawaan `kelola-bimbel`), `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
Kalau `POSTGRES_PASSWORD` kosong, skrip membuat sandi acak dan menampilkannya
sekali di layar — **salin segera ke pengelola secret Coolify**.

Perintah itu juga bisa dipakai untuk melihat daftar database:

```bash
COOLIFY_URL=... COOLIFY_TOKEN=... npm run coolify:db -- status
```

UUID server dan project diambil dari dashboard Coolify (menu _Servers_ dan
_Projects_), atau lewat API `GET /api/v1/servers` dan `GET /api/v1/projects`.
Menjalankan `buat` dua kali tidak membuat database kedua: resource dengan nama
yang sama dikenali dan dilewati.

**b. Lewat dashboard Coolify**

1. Buka project produksi → **+ New** → **Database** → **PostgreSQL**.
2. Pilih server produksi dan environment `production`.
3. Beri nama `kelola-bimbel`, isi user, database, dan sandi (sandi dari
   pengelola sandi, jangan diketik di catatan biasa).
4. Simpan. Coolify membuat container database dan **tidak** membuka portnya ke
   internet.

### 2. Versi dan sumber daya

- Image yang dipakai: `postgres:17-alpine` (PostgreSQL 17).
- Alokasi awal yang aman untuk bimbel kecil: 1 CPU, 512 MB memori. Naikkan bila
  jumlah jurnal harian bertambah.
- Database **tidak** diberi domain publik (`is_public` mati): akses hanya lewat
  jaringan internal Coolify.

### 3. Mengambil connection string internal

Di halaman resource database, bagian **Connection string** menyediakan dua
bentuk:

- **Internal** — hanya bisa dipakai dari container lain di server yang sama.
  Inilah yang dipakai aplikasi produksi:
  `postgres://<user>:<sandi>@<service-internal>:5432/<database>`
- **Public** — hanya untuk keperluan darurat dari luar server.

Di Coolify, `DATABASE_URL` produksi memakai bentuk **internal** supaya lalu
lintas database tidak pernah keluar dari jaringan internal. Nilai lengkapnya
disimpan sebagai secret Coolify pada Fase 2.

### 4. Uji koneksi sebelum rilis

Sebelum aplikasi di-deploy, pastikan kredensialnya benar-benar bisa dipakai.
Jalankan dari mesin yang punya akses ke database (mis. lewat terminal container
Coolify), tanpa menampilkan isi rahasianya:

```bash
DATABASE_URL=<connection string internal> npm run doctor
```

`npm run doctor` memeriksa koneksi ke PostgreSQL sekaligus keberadaan tabel
autentikasi inti. Hasil yang diharapkan: baris `✓ PostgreSQL connection and
authentication tables`. Kalau gagal, periksa ulang user, nama database, dan
sandi di resource Coolify — jangan menyalin nilainya ke berkas repo.

## Fase 2 — Rahasia & Deploy Aplikasi dari Dockerfile

### 1. Daftar variabel

| Variabel                 | Isi                                             | Catatan                                                                                               |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | connection string **internal** dari Fase 1      | dipakai aplikasi saat melayani permintaan                                                             |
| `BETTER_AUTH_SECRET`     | teks acak minimal 32 karakter                   | dipakai Better Auth untuk menandatangani sesi                                                         |
| `BETTER_AUTH_URL`        | origin publik, mis. `https://bimbel.contoh.com` | **harus** sama dengan alamat yang dibuka browser, tanpa garis miring di akhir                         |
| `MIGRATION_DATABASE_URL` | opsional                                        | hanya bila `DATABASE_URL` melewati pooler; migrasi memakai koneksi langsung                           |
| `MODE_RILIS`             | opsional                                        | penanda mode rilis; di produksi biarkan kosong (lihat catatan di bawah)                               |
| `PENJADWAL_BACKUP`       | opsional                                        | `nonaktif` mematikan penjadwal backup di dalam aplikasi (lihat “Menjalankan dan menjadwalkan backup”) |
| `BACKUP_DIR`             | opsional                                        | direktori salinan backup di dalam container; bawaannya `backups` di samping aplikasi                  |
| `BACKUP_COMMAND`         | opsional                                        | perintah dump untuk tombol backup manual dan penjadwal, mis. `pg_dump -Fc`                            |
| `RESTORE_DATABASE_URL`   | opsional                                        | connection string database **percobaan** untuk uji pemulihan, mis. `kelola_restore`                   |
| `RESTORE_COMMAND`        | opsional                                        | perintah pemulihan, mis. `pg_restore`; bawaannya `pg_restore` ke `RESTORE_DATABASE_URL`               |

Nilai `PORT` dan `HOSTNAME` tidak perlu diisi: image sudah memakai `3000` dan
`0.0.0.0`.

> **Belum lengkap (audit deploy):** tabel ini belum memuat kelompok `SMTP_*`
> (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`,
> `SMTP_FROM`, `SMTP_FROM_NAME`) dari `src/lib/smtp.ts`. Semuanya opsional,
> tetapi tanpa diisi email tautan atur ulang sandi tidak pernah keluar dari
> server. Rinciannya di `docs/audit-deploy-usang.md` (butir 1).

**`MODE_RILIS` — halaman contoh starter.** Halaman acuan tampilan bawaan
(`/app/contoh-status`) tidak untuk pengguna bimbel. Saklarnya bernama
`MODE_RILIS`: kalau dikosongkan, nilainya mengikuti `NODE_ENV`, dan container
rilis sudah jalan dengan `NODE_ENV=production` — jadi **di produksi tidak ada
yang perlu diisi**. Isi `true` hanya kalau ingin menutupnya lebih tegas, dan
isi `false` **hanya sementara** saat meninjau hasil build rilis dengan halaman
contoh tetap terbuka; jangan biarkan nilai itu tertinggal di environment
produksi. Nilai yang sah: `true/1/ya/yes/on` dan `false/0/tidak/no/off` (huruf
besar-kecil tidak berpengaruh). Salah tulis tidak membuat aplikasi gagal
start — nilainya diabaikan dan saklar kembali mengikuti `NODE_ENV`.

Saat mode rilis menyala, tautan halaman contoh hilang dari menu dan alamatnya
diputus di server (`src/proxy.ts`), jadi jawabannya sama dengan alamat yang
memang tidak ada. Verifikasi setelah deploy: buka `/app/contoh-status` — yang
muncul halaman **Halaman ini tidak tersedia**, bukan halaman contoh. Status
setiap variabel bisa dilihat owner di **Pengaturan → Lingkungan**.

### 2. Penyimpanan rahasia dan pemisahan lingkungan

- Isi nilai-nilai di atas pada **Environment Variables** resource aplikasi di
  Coolify (pakai opsi _locked/secret_ bila tersedia), **bukan** di berkas repo
  dan bukan di `.env.example` (berkas contoh hanya memuat placeholder).
- Buat environment `production` terpisah dari `staging`/`development` di Coolify
  supaya nilai produksi tidak tertukar saat uji coba.
- Verifikasi kelengkapan **tanpa menampilkan isinya**: cukup pastikan **ketiga**
  nama variabel wajib ada — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, dan
  `DATABASE_URL` — lalu jalankan `npm run doctor` untuk membuktikan koneksinya
  benar-benar bisa dipakai. Daftar resminya ada di
  `src/lib/variabel-lingkungan.ts`, dan halaman **Pengaturan → Lingkungan**
  membacakan kategori tiap nama ke owner tanpa menampilkan nilainya; di situ
  akan terlihat tiga baris bertanda wajib.
- Variabel lain **tidak wajib**: `MIGRATION_DATABASE_URL` diisi hanya bila
  `DATABASE_URL` melewati pooler, dan kelompok backup, pemulihan, serta SMTP
  boleh dikosongkan — aplikasinya tetap jalan, hanya fiturnya yang mati
  (mis. tanpa `SMTP_*` email tautan atur ulang sandi hanya masuk log server).

### 3. Membuat resource aplikasi

1. Di project produksi: **+ New** → **Application** → pilih sumber **Git
   repository** (`exoclb/kelola-bimbel`), branch `master` (branch produksi).
2. Pada **Build Pack**, pilih **Dockerfile** — jangan biarkan Coolify menebak
   (Nixpacks/auto) karena proyek ini memerlukan target khusus.
3. **Dockerfile location**: `aplikasi-manajemen-bimbel-offline-jurnal-mengajar/Dockerfile`
   (repo Git-nya berisi folder proyek, bukan Dockerfile di akar repo).
4. **Docker build target**: `runner`. Target ini berisi `.next/standalone` saja,
   jalan sebagai user `node` (bukan root), dan sudah membawa `HEALTHCHECK`.
5. **Port**: `3000`. **Domain**: kosongkan dulu (diisi di Fase 3).
6. Isi environment dari langkah 1, lalu **Deploy**.

`next build` di dalam image memakai placeholder sementara untuk `DATABASE_URL`
dan `BETTER_AUTH_SECRET` supaya pengumpulan data halaman tidak gagal. Placeholder
itu hanya hidup pada satu perintah build, tidak tersimpan di metadata image, dan
tidak pernah dipakai saat aplikasi melayani permintaan — nilai asli hanya
diberikan ke container yang jalan.

### 4. Rilis percobaan pertama

Deploy sekali, lalu periksa:

- Log build berakhir dengan `✓ Compiled successfully`, bukan galat.
- Container berstatus **running** dan healthcheck hijau (image memanggil
  `GET /icon.svg`; ini hanya liveness — mati database tidak otomatis
  me-restart proses).
- Buka alamat sementara yang diberikan Coolify: halaman masuk muncul.
- Di terminal container aplikasi, jalankan `node -e "console.log(!!process.env.DATABASE_URL)"`
  → `true` (membuktikan env terpasang tanpa membocorkan nilainya).

## Fase 3 — Migrasi Otomatis & Domain/HTTPS

### 1. Migrasi lewat target `migrator`

`Dockerfile` menyediakan target `migrator` yang menambah `drizzle-orm`, folder
`drizzle/`, dan `scripts/` di atas runtime. Target itu menjalankan
`node scripts/migrate.mjs`, yang memakai `MIGRATION_DATABASE_URL` bila ada dan
kalau tidak jatuh ke `DATABASE_URL`, lalu **keluar dengan kode 1 bila migrasi
gagal** (aplikasi tidak boleh lanjut dengan skema yang salah).

Cara paling langsung di server produksi:

```bash
docker build --target migrator -t kelola-migrator .
docker run --rm -e MIGRATION_DATABASE_URL="<connection string internal>" kelola-migrator
```

### 2. Menjalankannya tepat sebelum aplikasi hidup

Ada dua cara, pilih salah satu dan tulis di dokumen rilis:

- **Resource migrator terpisah (disarankan).** Buat Application kedua dari repo
  yang sama dengan **build target `migrator`** dan **Start Command**
  `node scripts/migrate.mjs`, tanpa domain dan tanpa port. Setiap kali ada
  rilis: deploy resource migrator lebih dulu, lihat lognya berakhir
  `PostgreSQL migrations applied.`, baru deploy resource aplikasi.
- **Pre-deployment command Coolify.** Di pengaturan deployment aplikasi, isi
  perintah yang menjalankan migrasi. Perintah ini berjalan **di container
  aplikasi yang lama**, jadi hanya bisa dipakai bila image runner ikut memuat
  berkas migrasi (tambahkan `drizzle/`, `scripts/`, dan `drizzle-orm` ke target
  `runner`). Perilaku Coolify yang perlu diketahui: perintah **dilewati pada
  deploy pertama** (belum ada container lama) dan **menghentikan deployment bila
  gagal** — sesuai kebutuhan gagal-henti kita. Jaga perintahnya aman diulang.

Apa pun cara yang dipilih, migrasi **tidak dibatalkan** oleh rollback aplikasi:
rollback hanya menukar image ke rilis sebelumnya. Karena itu jaga perubahan
skema tetap kompatibel mundur (tambah kolom/tabel baru dulu, hapus belakangan),
dan rencanakan pemulihan database secara terpisah bila ada perubahan berisiko.

### 3. Catatan log migrasi

- Log resource migrator tersimpan di halaman deployment Coolify; simpan tautannya
  di catatan rilis supaya jejaknya mudah dicari.
- Sebelum ke produksi, jalankan migrasi lebih dulu di lingkungan uji
  (`npm run test:e2e` memakai database uji terpisah, lihat `docs/local-development.md`).
- Migrasi penempatan multi-kelas `0014_penempatan_multi_kelas.sql` mengganti
  indeks unik penempatan murid (dari satu penempatan aktif per murid menjadi
  unik per pasangan murid–kelas) dan **tidak mengubah satu pun baris
  penempatan**, jadi riwayat lama tetap utuh. Selama migrasi belum diterapkan,
  perilakunya masih aturan lama; setelah diterapkan, menambah murid ke kelas
  lain langsung diterima. Rinciannya di `docs/penempatan-murid.md`.

### 4. Domain dan HTTPS

1. Buka resource aplikasi → **Domains**, isi domain produksi
   (`https://bimbel.contoh.com`), simpan, lalu tunggu reverse proxy Coolify
   memasang sertifikat HTTPS otomatis (Let's Encrypt). Jangan matikan
   verifikasi sertifikat di sisi aplikasi.
2. Isi `BETTER_AUTH_URL` dengan **origin publik yang sama, termasuk skema dan
   port**. Cookie sesi dan permintaan yang mengubah data menolak origin lain,
   jadi di belakang proxy nilai ini harus URL publik — bukan alamat container.
3. Simpan perubahan, deploy ulang, lalu uji dari domain asli: buka
   `https://bimbel.contoh.com/masuk`, masuk sebagai guru dan owner, pastikan
   tidak ada galat origin/cookie di konsol peramban, dan sesi tetap aktif
   setelah halaman dimuat ulang.

## Fase 4 — Auto-deploy dari Git & Backup Database

### 1. Webhook dan rilis otomatis

1. Di resource aplikasi → **Webhooks**: hubungkan repository (GitHub App atau
   deploy webhook) dengan branch `master` sebagai pemicu.
2. Push ke `master` → Coolify otomatis build dan deploy ulang. Uji dengan satu
   commit kecil, lalu lihat **Deployments**.
3. Nyalakan **Notifications** (email/Discord/Telegram sesuai kebutuhan) untuk
   kabar sukses maupun gagal setiap deploy.

> **Usang (audit deploy):** push ke `master` bukan lagi jalur rilis yang benar.
> Pipa CI (`.github/workflows/ci.yml`) memeriksa setiap push dan pull request,
> dan cabang `master` sudah menuntut status check `Ringkasan hasil CI` lulus
> sebelum digabung (`npm run ci:wajib`), jadi perubahannya masuk lewat pull
> request yang hijau; auto-deploy Coolify baru jalan setelah commit itu mendarat
> di `master`. Cara membaca hasil pipanya dari dalam aplikasi ada di Pengaturan
> → Status CI (`/app/pengaturan/ci`). Rinciannya di
> `docs/audit-deploy-usang.md` (butir 3).

### 2. Kembali ke rilis sebelumnya

Bila versi baru bermasalah: **Configuration → Rollback** → pilih image rilis
yang masih tersimpan → jalankan rollback, lalu pantau di **Deployments** dan
periksa aplikasinya. Perlu diingat: rollback memakai **konfigurasi runtime saat
ini** dengan image lama, jadi ia **tidak** membatalkan migrasi database,
**tidak** memulihkan berkas, dan **tidak** mengembalikan layanan lain.

### 3. Menjalankan dan menjadwalkan backup

#### a. Backup manual (sekali jalan)

Tombol **Jalankan backup sekarang** di **Pengaturan → Backup Database**
(`/app/pengaturan/backup`) mengambil salinan saat itu juga, memakai layanan yang
sama dengan penjadwal. Hasilnya langsung tampil di riwayat halaman itu: baris
`berjalan` selagi prosesnya jalan, lalu `sukses` beserta ukuran berkas dan
lokasinya, atau `gagal` beserta alasannya.

Dari terminal, perintah yang sama dijalankan `npm run db:backup` — itulah yang
dipakai cron di bawah. **Uji satu kali manual setiap kali `BACKUP_COMMAND` atau
`BACKUP_DIR` berubah**, supaya salah tulisnya ketahuan di situ, bukan lewat
catatan `gagal` yang menumpuk tiap hari.

#### b. Backup otomatis

Ada dua cara menjadwalkannya, dan pilih salah satu supaya salinannya tidak
dobel:

- **Penjadwal di dalam aplikasi** (bawaan: hidup). Jam, zona waktu, retensi, dan
  tempat simpannya diatur owner di **Pengaturan → Backup Database**
  (`/app/pengaturan/backup`). Jadwalnya disimpan di tabel `backup_settings`, dan
  aplikasi menjalankan dump sendiri tiap kali jam itu lewat — termasuk menyusul
  slot yang terlewat saat container sempat mati. Perintah dumpnya dibaca dari
  `BACKUP_COMMAND`, jadi **aplikasi harus bisa memanggil `pg_dump`**: image bawaan
  belum memuatnya, dan versi `pg_dump` tidak boleh lebih tua daripada server
  PostgreSQL-nya. Kalau di deployment ini itu merepotkan, matikan penjadwalnya
  dengan `PENJADWAL_BACKUP=nonaktif` (lihat tabel variabel di atas) dan pakai cron.
- **Cron di luar aplikasi** (paling aman untuk Coolify, karena container
  database-nya sudah punya `pg_dump` yang versinya cocok). Aplikasi tidak perlu
  tahu siapa yang menjalankannya: setiap proses backup menulis satu baris ke
  tabel `backup_runs`, dan owner melihatnya di halaman yang sama — kapan backup
  terakhir berhasil, berapa catatan yang gagal, dan di mana salinannya disimpan.

Setelan bawaan penjadwal di aplikasi (semuanya bisa diubah owner di halaman
Backup, dan berlaku tanpa menyalakan ulang server):

| Setelan            | Bawaan                | Artinya                                                                                      |
| ------------------ | --------------------- | -------------------------------------------------------------------------------------------- |
| Status             | Aktif                 | Penjadwal memeriksa jadwalnya tiap menit selama aplikasi hidup                               |
| Jam mulai          | `02:00`               | Dini hari, di luar jam mengajar                                                              |
| Zona waktu         | `Asia/Jakarta` (WIB)  | Pilihan lain: WITA (`Asia/Makassar`) dan WIT (`Asia/Jayapura`)                               |
| Retensi            | 30 hari               | Dipakai menilai kesegaran salinan terakhir; lihat §6 soal siapa yang menghapus berkas        |
| Tempat penyimpanan | `/var/backups/kelola` | Harus path absolut di server; **wajib disalin lagi** ke penyimpanan terpisah (§b, langkah 4) |

Langkah cron (di server/Coolify, memakai container database yang sama):

1. Tambahkan `PENJADWAL_BACKUP=nonaktif` ke environment aplikasi supaya tidak
   ada dua penjadwal yang menulis catatan (dan supaya pemanggilan `pg_dump`
   yang gagal tidak menumpuk sebagai catatan `gagal` tiap hari).
2. Buat skrip kecil di server, mis. `/opt/kelola/backup.sh`. Pencatatannya
   dilakukan `npm run db:backup`: ia menulis baris `berjalan` lebih dulu,
   menjalankan dump, lalu menutup barisnya sebagai `sukses` (lengkap dengan
   ukuran dan lokasi berkas) atau `gagal` beserta alasan kegagalannya — dan
   keluar dengan kode bukan nol supaya penjadwal ikut tahu:

   ```bash
   #!/bin/sh
   set -eu
   cd /opt/kelola/app
   BACKUP_DIR=/var/backups/kelola \
   BACKUP_COMMAND="docker exec -i <container-database> \
     pg_dump -U \$POSTGRES_USER -d \$POSTGRES_DB -Fc" \
     npm run db:backup
   # simpan ke lokasi terpisah (rclone/S3) supaya tidak hilang bersama server
   rclone copy /var/backups/kelola remote:kelola-backup/ || true
   # retensi: sisakan 30 hari
   find /var/backups/kelola -name '*.dump' -mtime +30 -delete
   ```

   Perintah dump harus menulis ke stdout (seperti `pg_dump` tanpa `-f`); kalau
   perintahnya memuat `{file}`, penanda itu diganti dengan berkas tujuan.

   Nama container database diambil dari dashboard Coolify; jangan menulis sandi
   di skrip — cukup `docker exec` ke container yang sudah punya env-nya.

3. Jadwalkan lewat **Scheduled Task** pada resource database di Coolify (format
   cron, mis. `0 2 * * *`) atau `crontab -e` di server. Pastikan jadwalnya di
   luar jam sibuk, dan samakan jamnya dengan yang tertulis di halaman
   Pengaturan supaya tidak membingungkan operator.
4. **Penyimpanan terpisah** wajib: salinan di server yang sama bukan backup.
5. **Aturan retensi** ditulis eksplisit (contoh di atas 30 hari) dan diperiksa
   berkala agar disk tidak penuh.

Kalau memakai penjadwal aplikasi, isi `BACKUP_COMMAND` dengan perintah dump yang
berjalan dari container aplikasi (mis. `pg_dump -Fc` setelah
`postgresql-client` dipasang di image, atau `{file}` kalau aplikasinya bisa
memanggil Docker), lalu uji sekali lewat tombol **Jalankan backup sekarang** di
halaman Backup: hasilnya harus muncul sebagai catatan `sukses` di riwayat, dan
berkasnya ada di direktori tujuan yang tertulis di halaman itu.

#### c. Membaca status dan riwayatnya

Semua hasilnya terbaca di halaman **Pengaturan → Backup Database**; log
container hanya perlu dibuka kalau mencari sebab kegagalan yang tidak ditulis
prosesnya.

- **Dua kartu hitungan di atas**: “Total catatan backup” (jumlah seluruh baris
  `backup_runs`, lengkap dengan berapa yang berhasil dan berapa yang gagal) dan
  “Sedang berjalan”. Kalau angka “Sedang berjalan” tidak kembali ke nol, ada
  proses yang menggantung: catatannya tetap `berjalan` karena prosesnya berhenti
  sebelum menutup barisnya.
- **Ringkasan backup terakhir berhasil**: waktu salinan terakhir yang sukses
  beserta umurnya (“hari ini”, “kemarin”, “3 hari lalu”), lama prosesnya, ukuran
  berkasnya, dan lokasinya. Bagian ini yang menjawab “salinan terakhir masih
  layak dipakai atau tidak” tanpa menelusuri riwayat; kartunya kosong sampai
  backup pertama selesai.
- **Kesegaran** di ringkasan itu menilai umur salinan terhadap jadwal yang
  berlaku — inilah tanda peringatan dini yang paling cepat terbaca:
  - **Sesuai jadwal** — masih dalam jadwal ditambah tenggang dua jam (proses
    backup boleh telat sedikit tanpa berarti penjadwalnya rusak).
  - **Terlambat** — jadwal berikutnya seharusnya sudah membuat salinan baru.
    Periksa penjadwal dan log backup di server.
  - **Lewat retensi** — umurnya sudah melewati angka **Retensi**. Berkasnya bisa
    jadi masih ada (aplikasi tidak menghapusnya, lihat §6), tetapi salinan
    sesegar itu tidak lagi cukup untuk pemulihan, jadi jadwalnya harus
    dibetulkan.
- **Riwayat backup**: 20 catatan terbaru, yang paling baru di atas. Tiap baris
  memuat waktu mulai, ukuran · lama proses · lokasi berkas, dan lencana status
  `sukses`/`gagal`/`berjalan`. Baris `gagal` menampilkan alasan yang ditulis
  prosesnya; kalau alasannya kosong, prosesnya berhenti sebelum sempat menulis
  pesan — cari sebabnya di log container pada jam itu. Tabel `backup_runs`
  menyimpan **semua** catatan dan halaman hanya menampilkan 20 terbaru, jadi
  jumlah totalnya tetap terbaca dari kartu hitungan.
- **Riwayat uji pemulihan**: tiga catatan uji terbaru sebagai pengingat, dengan
  sisanya di halaman Uji Pemulihan. Selama halaman itu masih memakai contoh,
  isinya ditandai “contoh bentuk” dan belum bisa dipakai sebagai bukti.

Halaman ini menunjukkan apa yang **sudah** terjadi: ia tidak menandai jadwal yang
terlewat di luar label Kesegaran di atas, dan barisnya baru muncul setelah
prosesnya benar-benar mulai — dari tombol, penjadwal di aplikasi, atau cron.

### 4. Uji pemulihan

Uji **minimal sekali per kuartal (90 hari)** — angka yang dianjurkan halaman Uji
Pemulihan — dan lebih sering setiap kali skema datanya berubah, di lingkungan
percobaan, bukan produksi:

```bash
createdb kelola_restore
pg_restore -U <user> -d kelola_restore /var/backups/kelola/<stamp>.dump
# arahkan DATABASE_URL sementara ke kelola_restore, jalankan npm run doctor & uji login
dropdb kelola_restore
```

Backup yang belum pernah diuji pulih belum bisa diandalkan.

Perintah yang sama bisa dijalankan aplikasi lewat halaman Pengaturan → Backup →
Uji Pemulihan, tanpa perlu masuk ke container. Isi dua variabel berikut:

```bash
RESTORE_DATABASE_URL=postgres://<user>:<sandi>@<host>:5432/kelola_restore
# opsional; kalau kosong dipakai `pg_restore -d $RESTORE_DATABASE_URL`
RESTORE_COMMAND="docker exec -i <container> pg_restore -U $POSTGRES_USER -d kelola_restore {file}"
```

`RESTORE_DATABASE_URL` sengaja diwajibkan walau `RESTORE_COMMAND` ditulis sendiri:
dari situlah aplikasi tahu nama database tujuannya, dan pemulihannya
**dibatalkan** kalau namanya sama dengan database yang sedang dipakai aplikasi —
percobaan yang salah tulis jangan sampai menimpa data produksi. Isi `{file}` pada
`RESTORE_COMMAND` kalau perintahnya sudah menyebut berkas salinannya sendiri;
kalau tidak, path berkas itu ditambahkan di belakang perintah.

Aplikasi hanya menjalankan satu uji sekaligus, karena semuanya menuangkan isinya
ke database percobaan yang sama. Penahan itu ada di dalam satu proses aplikasi —
kalau container-nya dijalankan lebih dari satu replika, jalankan uji pemulihan
dari satu replika saja atau tunggu sampai uji sebelumnya selesai.

Sesudah pemulihannya selesai, aplikasi memeriksa sendiri isi database percobaan
(`periksaHasilPemulihan`). Empat pemeriksaan bakunya:

| Pemeriksaan                   | Lulus kalau                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Jumlah murid sesuai           | ada isinya dan tidak melebihi jumlah murid di produksi sekarang                       |
| Jumlah jurnal mengajar sesuai | ada isinya dan tidak melebihi jumlah jurnal di produksi sekarang                      |
| Jumlah tagihan sesuai         | ada isinya dan tidak melebihi jumlah tagihan di produksi sekarang                     |
| Akun owner bisa masuk         | di salinan itu masih ada akun owner/admin yang belum di-ban dan punya sandi tersimpan |

Tiga pemeriksaan pertama membandingkan jumlah di salinan dengan **produksi
sekarang** — jumlah saat backup dibuat tidak tersimpan di mana pun. Salinan yang
isinya lebih sedikit itu wajar (jurnal dan tagihan bertambah terus, dan salinan
selalu dibuat lebih dulu), tapi **kosong** atau justru **lebih banyak** daripada
produksi dilaporkan gagal: yang pertama berarti berkasnya tidak benar-benar ikut
pulih, yang kedua tanda ada data yang terhapus setelah backup dibuat. Pemeriksaan
keempat hanya melihat salinannya — produksinya tidak ikut dihitung — karena yang
perlu dibuktikan adalah “masih bisa masuk ke bimbel ini” setelah dipulihkan.

Database percobaan yang tidak bisa dihubungi — mis. `RESTORE_DATABASE_URL` salah
tulis — juga gagal semua, jadi uji yang tidak benar-benar memeriksa apa pun tidak
pernah terbaca lulus. Hasil keempatnya dirangkum jadi satu penilaian:
**terverifikasi** (semua pemeriksaan lulus), **belum lengkap** (yang dijalankan
lulus semua, tetapi ada pemeriksaan baku yang tidak dijalankan), **bermasalah**
(ada yang tidak lulus), atau **belum ada** yang diperiksa.

#### Membaca halaman Uji Pemulihan

Halaman **Pengaturan → Backup → Uji Pemulihan**
(`/app/pengaturan/backup/uji-pemulihan`) menampilkan hasilnya untuk operator:
proses yang sedang berjalan beserta tahapnya (siapkan database percobaan,
pulihkan berkas, periksa keutuhan data, catat hasil), ringkasan uji terakhir yang
berhasil beserta label kesegarannya (**Masih berlaku** / **Perlu diuji ulang** /
**Belum pernah diuji**), panel verifikasi (mana dari empat pemeriksaan baku yang
lulus, gagal, atau belum dijalankan, lengkap dengan angka kedua sisi di
catatannya), daftar berkas backup yang siap diuji, langkah bakunya, dan riwayat
ujinya.

Selama halaman itu **belum tersambung ke server**, berkas, proses yang berjalan,
ringkasan, verifikasi, dan riwayatnya masih **contoh bentuk** dan tidak boleh
dibaca sebagai bukti uji pemulihan yang sungguh sudah dilakukan — ujinya sendiri
tetap dijalankan manual di server mengikuti langkah di atas, dan buktinya adalah
catatan yang tertulis di riwayat backup (lihat paragraf berikutnya).

Hasil setiap uji ikut dicatat ke riwayat backup: catatan berkas yang diuji
menyimpan rangkuman kapan berkas itu terakhir diuji, di database mana, berapa
pemeriksaan yang lulus, dan angka yang dibandingkan. Jadi bukti uji pemulihan
tertinggal di halaman Pengaturan → Backup — bukan cuma muncul sekali di layar
lalu hilang — dan berkas yang belum pernah diuji terlihat dari catatan yang
masih kosong. Riwayat tiap percobaan tidak disimpan; yang tersisa adalah keadaan
terakhir berkas itu diuji, termasuk kalau ujinya gagal.

### 5. Memulihkan data sungguhan (kalau salinan itu benar-benar dipakai)

Uji pemulihan di atas sengaja **tidak bisa** menyentuh database produksi:
perintahnya dibatalkan begitu nama database tujuannya sama dengan database yang
sedang dipakai aplikasi. Jadi pada kejadian sungguhan — data rusak, tabel
terhapus, server mati — pemulihannya dikerjakan manual, dan urutannya begini:

1. **Amankan keadaan sekarang dulu.** Ambil satu salinan database yang sedang
   berjalan (mis. `pg_dump -Fc` ke berkas baru) sebelum apa pun ditimpa. Kalau
   tidak, satu-satunya bukti tentang apa yang terjadi juga hilang.
2. **Pulihkan ke database baru**, jangan ke yang sedang dipakai:
   `createdb kelola_pulih` lalu `pg_restore -d kelola_pulih <berkas>.dump`.
3. **Periksa isinya sebelum diarahkan** (bagian uji pemulihan di atas): jumlah
   murid, jurnal, dan tagihan harus ada isinya dan tidak melebihi produksi
   sekarang, dan harus ada akun owner/admin yang bisa masuk. Percobaan login
   benar-benar penting di sini — inilah bedanya memakai salinan sungguhan dengan
   lulus pemeriksaan angka.

   ```bash
   # jumlah di salinan (bandingkan dengan produksi sekarang)
   psql "$DATABASE_PULIH" -c "SELECT
     (SELECT count(*) FROM students) AS murid,
     (SELECT count(*) FROM teaching_journals) AS jurnal,
     (SELECT count(*) FROM student_invoices) AS tagihan"
   ```

4. **Arahkan aplikasi ke database itu**: ubah `DATABASE_URL` (dan
   `MIGRATION_DATABASE_URL` kalau dipakai) di environment ke database baru, lalu
   deploy ulang — aplikasi membaca `DATABASE_URL` saat start, jadi tanpa deploy
   ulang perubahannya tidak berlaku. Kalau salinannya lebih tua daripada kode
   yang berjalan, jalankan `npm run db:migrate` dulu supaya skemanya sejajar,
   lalu `npm run doctor` untuk memastikan aplikasinya benar-benar tersambung ke
   database itu.
5. **Jangan hapus database lama sampai bimbel memastikan datanya benar.** Hapus
   setelah satu-dua hari pemakaian normal; selama itu database lamanya jadi jalur
   mundur kalau ternyata ada yang kurang.
6. **Beri tahu penggunanya.** Sesi login tersimpan di tabel `session`, jadi sesi
   yang dibuat setelah tanggal backup tidak ada lagi di salinan — guru dan owner
   yang masuk setelah itu akan diminta masuk ulang, memakai sandi yang berlaku
   **saat backup dibuat**. Siapa pun yang mengganti sandinya sesudah itu perlu
   memakai sandi lamanya, atau lewat tautan lupa sandi.

Pemulihan data seperti ini juga **mengembalikan pengaturan**, bukan cuma data
bimbel: jadwal backup, retensi, dan tujuan salinan di tabel `backup_settings`
ikut kembali ke nilai saat backup dibuat, begitu juga riwayat `backup_runs`.
Periksa halamannya lagi sesudah dipulihkan, dan betulkan jadwalnya kalau sejak
dulu sudah pernah diubah — kalau tidak, penjadwalnya menjalankan setelan lama
(catatan `berjalan`/`gagal` sebelum tanggal itu juga muncul lagi di riwayat).

### 6. Siapa yang menjalankan, seberapa sering, dan di mana buktinya

- **Pemiliknya owner bimbel.** Jadwal backup dan uji pemulihan diatur di halaman
  **Pengaturan → Backup Database**, dan hanya owner/admin yang bisa mengubahnya.
  Kalau backup diserahkan ke cron, pelaksananya operator server yang memegang
  `crontab`/Scheduled Task, sementara owner tetap pemilik hasilnya — dia yang
  membuka halamannya. Tentukan satu nama sejak awal; jadwal tanpa pemilik
  biasanya baru ketahuan salah saat salinannya dibutuhkan.
- **Backup: harian.** Bawaannya 02.00 WIB, di luar jam mengajar. Jangan lebih
  jarang dari sehari: jurnal dan tagihan berubah tiap hari. **Periksa riwayatnya
  minimal sekali seminggu** — yang dilihat bukan cuma ada/tiadanya baris, tetapi
  status baris terakhir. Satu baris `gagal` harus dibetulkan sebelum minggu
  berikutnya, karena salinan yang gagal tidak bisa dipulihkan.
- **Uji pemulihan: minimal sekali per kuartal** (§4), atau lebih sering kalau
  skema datanya berubah — supaya salinan yang rusak atau perintah pemulihan yang
  melenceng ketahuan sebelum bencana sungguhan. Kalau salinannya benar-benar
  perlu dipakai, ikuti urutan di §5, bukan menimpa database yang sedang jalan.
- **Buktinya ada di aplikasi, bukan catatan terpisah.** Semua proses — tombol di
  halaman, penjadwal di aplikasi, maupun `npm run db:backup` dari cron — menulis
  baris ke tabel `backup_runs`, dan halaman **Pengaturan → Backup** menampilkan
  20 catatan terbaru (waktu mulai, status, ukuran, lokasi berkas, alasan
  kegagalan), backup terakhir yang berhasil, dan rangkuman uji pemulihan tiap
  berkas. Jadi untuk membuktikan kesiapan rilis: buka halaman itu dan tunjukkan
  baris `sukses` terakhir beserta catatan uji pemulihannya. Kalau bimbel butuh
  jejak untuk pemeriksaan berkala, simpan tautan halaman itu (atau tangkapan
  layarnya) di catatan rilis — tidak perlu membuat buku catatan backup manual.
- **Retensi berkas diatur di sisi server.** Angka **Retensi** di formulir
  (bawaan 30 hari) dipakai aplikasi untuk menilai kesegaran salinan terakhir,
  tetapi **aplikasi tidak menghapus berkas backup**. Yang memutuskan kapan
  berkas lama hilang adalah cron/skrip di server — contoh perintah retensinya ada
  di langkah 5 pada daftar cron di atas — atau layanan penyimpanan objeknya.
  Tulis aturannya di catatan rilis, dan periksa kapasitas disknya berkala.

## Fase 5 — Panduan & Uji Coba Go-live

### 1. Uji masuk per peran

Di server produksi, uji dengan akun nyata (bukan akun uji):

- **Guru**: masuk → diarahkan ke halaman kerja guru → menu "Isi Jurnal" dan
  "Gaji saya" terlihat, menu owner tidak.
- **Owner**: masuk → halaman pemantauan → menu Pemantauan, Gaji, Guru, Akun,
  Backup terlihat.
- Uji juga **lupa sandi** dan **atur ulang sandi** dari domain asli.
- Pastikan akun yang dinonaktifkan tidak bisa masuk.

> **Belum lengkap (audit deploy):** uji lupa sandi di atas baru berjalan seperti
> yang diharapkan kalau penyedia emailnya sudah diatur. Tanpa `SMTP_*`, tautan
> atur ulang sandi **tetap** dibuat tetapi hanya dicatat ke log container
> (`src/lib/smtp.ts`: `pakaiCadanganLogTautan`), jadi tidak ada email yang
> masuk. Pastikan dulu kanal emailnya, lalu ujilah dari domain asli. Rinciannya
> di `docs/audit-deploy-usang.md` (butir 4).

### 2. Uji alur inti di produksi

Jalankan berurutan dengan data uji, lalu rapikan datanya:

1. Buat kelas + jadwal (pastikan bentrok jadwal ditolak).
2. Tambah murid dan tempatkan ke kelas (pastikan penempatan dobel di kelas yang
   sama ditolak).
3. Isi jurnal untuk jadwal hari ini, tandai kehadiran murid, kirim; kirim ulang
   jurnal yang sama → data diperbarui, tidak ganda.
4. Catat perkembangan murid (nilai, sikap, catatan) dan cetak laporannya.
5. Owner: periksa pemantauan harian, rekap gaji, tandai dibayar, cetak slip.
6. Cek notifikasi dan halaman **Pengaturan → Backup Database**.

### 3. Checklist go-live

- [ ] Database produksi jalan, port tidak terbuka ke internet, `npm run doctor` hijau.
- [ ] Ketiga variabel wajib (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
      `DATABASE_URL`) ada di secret Coolify; tidak ada **nilai** rahasia di
      repo — hanya nama variabel yang muncul (di `.env.example`, `docs/`, dan
      `scripts/`), dan pemindaian nilai dari `.env.local` atas semua berkas
      terlacak menghasilkan 0 temuan.
- [ ] Build memakai Dockerfile target `runner`; healthcheck hijau.
- [ ] Migrasi terakhir sudah dijalankan dan lognya tersimpan.
- [ ] Domain + HTTPS aktif; `BETTER_AUTH_URL` sama persis dengan domain itu.
- [ ] Login guru & owner dari domain asli berhasil; cookie sesi bertahan.
- [ ] Halaman contoh tertutup: `/app/contoh-status` menjawab **Halaman ini tidak
      tersedia** dan tidak ada tautan contoh di menu; `MODE_RILIS` tidak
      tertinggal bernilai `false`.
- [ ] Auto-deploy dari `master` teruji; notifikasi deploy aktif.
- [ ] Backup terjadwal jalan; baris terakhir di riwayat berstatus `sukses`;
      salinannya juga tersimpan di penyimpanan terpisah; aturan retensi berkas
      ditulis (Fase 4 §6).
- [ ] Uji pemulihan pernah berhasil, dan catatannya terbaca di riwayat backup
      (Fase 4 §4–§6).
- [ ] Akun uji dibersihkan; hanya akun sungguhan yang tersisa.

> **Perlu bukti (audit deploy):** klaim “0 temuan” pada butir di atas belum bisa
> diulang pembaca — tidak ada perintah, skrip, maupun ujinya di repo.
> Rinciannya di `docs/audit-deploy-usang.md` (butir 6).

## Masalah yang sering muncul

| Gejala                                    | Kemungkinan sebab                                                             | Tindakan                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Build gagal `ECONNREFUSED 127.0.0.1:5432` | halaman terproteksi ikut di-prerender saat build                              | pastikan `dynamic = "force-dynamic"` di `src/app/(protected)/layout.tsx` tetap ada                                     |
| Deploy sukses tapi halaman 502            | container mati setelah start (env salah)                                      | cek log container: `DATABASE_URL`/`BETTER_AUTH_SECRET` kosong atau salah bentuk                                        |
| Login berhasil lalu langsung keluar       | `BETTER_AUTH_URL` tidak sama dengan origin yang dibuka                        | samakan dengan domain publik (termasuk skema/port), deploy ulang                                                       |
| `Invalid origin` saat mengirim data       | domain lain/proxy mengubah origin                                             | akses lewat domain resmi; jangan menambah origin lain tanpa alasan                                                     |
| Aplikasi jalan tapi tabel tidak ada       | migrasi belum dijalankan                                                      | jalankan resource migrator, lihat log `PostgreSQL migrations applied.`                                                 |
| Migrasi gagal saat deploy                 | perintah pre-deployment gagal                                                 | perbaiki penyebabnya di lingkungan uji dulu; migrasi tidak boleh di-skip                                               |
| Rollback tidak mengembalikan data         | rollback hanya menukar image                                                  | pulihkan database dari backup (Fase 4)                                                                                 |
| Halaman contoh masih terbuka di produksi  | `MODE_RILIS=false` tertinggal di environment produksi                         | hapus variabelnya (atau isi `true`), deploy ulang, lalu uji ulang rutenya                                              |
| Backup terjadwal tidak pernah jalan       | `PENJADWAL_BACKUP=nonaktif` tertinggal, atau `pg_dump` tidak ada di container | cek environment aplikasi dan log container; jalankan tombol **Jalankan backup sekarang** untuk membuktikan perintahnya |
| Catatan backup `gagal` setiap hari        | perintah dumpnya tidak bisa dipanggil dari container aplikasi                 | uji lewat tombol manual, betulkan `BACKUP_COMMAND`, atau pindahkan jadwalnya ke cron                                   |

Referensi Coolify: [Rollback](https://coolify.io/docs/applications/deployments/rollbacks) ·
[Dockerfile build](https://coolify.io/docs/applications/builds/dockerfile)
