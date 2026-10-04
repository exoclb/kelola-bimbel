# Deploy Produksi ke Coolify

Panduan ini disusun bertahap mengikuti fase rilis. Bagian yang sudah ditulis di
bawah adalah **Fase 1 — Basis Data Produksi**.

Aturan pokok: **tidak ada nilai rahasia di repo**. Semua nilai sensitif
(`DATABASE_URL`, `BETTER_AUTH_SECRET`, sandi database) hanya disimpan di
pengelola secret Coolify.

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
node scripts/coolify-db.mjs buat
```

Env opsional: `COOLIFY_ENVIRONMENT` (bawaan `production`), `COOLIFY_DB_NAME`
(bawaan `kelola-bimbel`), `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
Kalau `POSTGRES_PASSWORD` kosong, skrip membuat sandi acak dan menampilkannya
sekali di layar — **salin segera ke pengelola secret Coolify**.

Perintah itu juga bisa dipakai untuk melihat daftar database:

```bash
COOLIFY_URL=... COOLIFY_TOKEN=... node scripts/coolify-db.mjs status
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

## Status backup di aplikasi

Setiap proses backup di server menulis satu baris ke tabel `backup_runs`, dan
owner bisa memantaunya di halaman **Pengaturan → Backup Database**
(`/app/pengaturan/backup`): kapan backup terakhir berhasil, berapa catatan yang
gagal, dan di mana salinannya disimpan. Halaman itu hanya membaca; jadwal,
penyimpanan terpisah, retensi, dan uji pemulihan tetap diatur di sisi server
(bagian Fase 4 akan melengkapinya).
