# Audit langkah deploy yang usang

Catatan audit dua dokumen deploy: `docs/deploy-coolify.md` (panduan operator,
bahasa Indonesia) dan `docs/deployment.md` (catatan host-netral, bahasa Inggris).
Keadaan kode yang diperiksa: commit `92ca2b0` pada cabang `master`.

Berkas ini **catatan sementara**: tugas Fase 4 berikutnya membereskan temuannya di
dokumen aslinya. Setelah semua temuan tertutup, tanda `> **Usang (audit):**` di
kedua dokumen itu dan berkas ini boleh dihapus.

Cara membaca istilah di bawah:

- **Usang** — langkah atau pernyataannya sekarang salah dan bisa menyesatkan
  operator yang mengikutinya hari ini.
- **Belum lengkap** — langkahnya tidak salah, tetapi ada bagian yang hilang
  sehingga hasilnya tidak seperti yang diharapkan pembaca.
- **Perlu bukti** — klaimnya tidak bisa diperiksa ulang karena tidak ada
  perintah atau rujukan yang menyertainya.

## Ringkasan temuan

| #   | Lokasi                                     | Keadaan                                                                                            | Jenis         | Ditangani oleh         |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------- | ---------------------- |
| 1   | `deploy-coolify.md` Fase 2 §1 (tabel)      | Tabel variabel belum memuat kelompok `SMTP_*`                                                      | Belum lengkap | Catatan SMTP & CI      |
| 2   | `deploy-coolify.md` Fase 2 §2 dan Fase 5   | Menyebut “keempat variabel **wajib**”, padahal yang wajib tiga                                     | Usang         | Panduan Deploy Terbaru |
| 3   | `deploy-coolify.md` Fase 4 §1              | “Push ke `master` → Coolify otomatis deploy”, tanpa langkah CI maupun syarat status check          | Usang         | Catatan SMTP & CI      |
| 4   | `deploy-coolify.md` Fase 5 §1              | “Uji lupa sandi dari domain asli” mengandaikan email benar-benar terkirim tanpa menyiapkan SMTP    | Belum lengkap | Catatan SMTP & CI      |
| 5   | `deploy-coolify.md` Fase 4 §3–§4           | Cara menjalankan backup dan uji pemulihan sudah ada, tetapi tanpa jangka waktu, pemilik, dan bukti | Belum lengkap | Catatan Backup & Pulih |
| 6   | `deploy-coolify.md` Fase 5 (checklist)     | “pemindaian nilai dari `.env.local` … menghasilkan 0 temuan” tanpa perintah yang bisa dijalankan   | Perlu bukti   | Panduan Deploy Terbaru |
| 7   | `deployment.md` (blok `dotenv` + paragraf) | Blok variabel minim dan pernyataannya bahwa email hanya bisa ditambahkan “when needed”             | Usang         | Catatan SMTP & CI      |
| 8   | `deployment.md` (judul + kalimat terakhir) | Judul masih “PostgreSQL starter” dan satu kalimat terakhir berbahasa Indonesia di dokumen Inggris  | Perlu dibaca  | Panduan Deploy Terbaru |

## Rincian

### 1. Kelompok `SMTP_*` belum ada di tabel variabel

Kanal email sudah jalan: `src/lib/smtp.ts` membaca `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, dan `SMTP_FROM_NAME`,
lalu `src/services/email.service.ts` mengirim email tautan atur ulang sandi.
Tabel Fase 2 §1 dan blok `dotenv` di `deployment.md` belum memuat satu pun nama
itu, jadi operator yang mengikuti panduan ini mendarat di produksi tanpa email
apa pun — dan baru sadar saat ada guru yang lupa sandinya.

Semuanya opsional (aplikasi tetap jalan tanpa itu), tetapi tanpa diisi tautan
atur ulang sandi **hanya** muncul di log container. Daftar resminya ada di
`src/lib/variabel-lingkungan.ts`, dan halaman Pengaturan → Lingkungan
(`/app/pengaturan/lingkungan`) membacakan kategori wajib/opsional tiap variabel
ke owner tanpa menampilkan nilainya.

### 2. “Keempat variabel wajib” sebenarnya tiga

Fase 2 §2 menulis “pastikan keempat nama variabel wajib ada”, dan checklist
go-live menulis “Keempat variabel ada di secret Coolify”. Yang benar: variabel
berkategori `wajib` hanya **tiga** — `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`DATABASE_URL` (`src/lib/variabel-lingkungan.ts`). `MIGRATION_DATABASE_URL`
opsional (“hanya bila `DATABASE_URL` melewati pooler”), seperti juga variabel
backup, pemulihan, dan SMTP.

Angka “empat” membuat langkah verifikasi tidak bisa lulus apa adanya: operator
yang menghitung lewat halaman Pengaturan → Lingkungan akan menemukan tiga baris
bertanda wajib.

### 3. Alur rilis belum menyebut CI dan syarat status check

Fase 4 §1 mengajarkan “Push ke `master` → Coolify otomatis build dan deploy
ulang”. Sejak pipa CI ada, push ke `master` bukan lagi jalur rilis yang benar:
`.github/workflows/ci.yml` menjalankan tiga job (`check`, `e2e`, `ringkasan`)
pada setiap push dan pull request, dan cabang `master` sudah menuntut job
terakhir — status check **`Ringkasan hasil CI`** — lulus sebelum digabung
(`npm run ci:wajib`, lihat `docs/local-development.md`). Jadi perubahan masuk
lewat pull request yang pipanya hijau; auto-deploy Coolify jalan setelah commit
itu mendarat di `master`.

Yang belum tertulis di panduan deploy: cara membaca hasil pipanya dari dalam
aplikasi (Pengaturan → Status CI, `/app/pengaturan/ci`, sumber daftarnya di
`src/lib/ci-otomatis.ts`) dan perintah memasang syarat merge-nya.

### 4. Uji lupa sandi mengandaikan email terkirim

Fase 5 §1 meminta menguji lupa sandi dan atur ulang sandi “dari domain asli”,
tetapi tidak menyebut prasyaratnya. Perilaku sebenarnya ada di
`src/lib/smtp.ts` (`pakaiCadanganLogTautan`): tanpa SMTP terpasang, tautan tetap
dicatat ke log container supaya bimbel yang belum punya penyedia email tidak
kehilangan jalur pemulihan; kalau SMTP terpasang, tautannya dikirim sebagai
email dan kegagalannya dicatat tanpa tautan. Operator perlu tahu keduanya supaya
tidak menyimpulkan fitur lupa sandinya rusak.

### 5. Backup dan uji pemulihan: caranya ada, jadwal dan buktinya belum

Fase 4 §3–§4 sudah lengkap soal **cara**: dua pilihan penjadwal, langkah cron,
penyimpanan terpisah, retensi, dan uji pemulihan lewat halaman Pengaturan →
Backup. Yang belum diatur di dokumen: seberapa sering (dokumen hanya menulis
“minimal satu kali per periode”), siapa yang menjalankan, dan di mana buktinya
disimpan. Riwayatnya sendiri sudah tersedia di aplikasi — `backup_runs`
menyimpan hasil tiap backup, dan uji pemulihan menuliskan rangkuman terakhir
per berkas (`src/services/backup.service.ts`), jadi bagian operasionalnya bisa
menunjuk ke halaman itu alih-alih meminta catatan terpisah.

### 6. Klaim “0 temuan” tanpa perintah

Checklist go-live menyatakan tidak ada nilai rahasia di berkas terlacak karena
“pemindaian nilai dari `.env.local` atas semua berkas terlacak menghasilkan 0
temuan”. Pemindaian itu tidak punya perintah, skrip, maupun uji yang bisa
dijalankan ulang — tidak ada namanya di `package.json` dan tidak ada di
`tests/`. Klaimnya benar untuk repo ini saat diperiksa, tetapi pembaca tidak bisa
membuktikannya. Perbaikan: tulis perintahnya, atau ganti dengan pernyataan yang
bisa diperiksa (mis. nama variabel saja yang muncul di `.env.example` dan
`docs/`).

### 7. `docs/deployment.md` belum mengenal email

Dua bagian di dokumen host-netral itu perlu diselaraskan:

- Blok `dotenv` hanya memuat variabel database, auth, mode rilis, dan backup —
  belum `SMTP_*`. Tanpa itu, deploy host apa pun akan kehilangan email.
- Paragraf “Account emails are not verified by the base. Add an email provider
  for verification and password recovery when needed.” Sekarang setengahnya
  keliru: pemulihan sandi **sudah** punya penyedianya (`SMTP_*`), sedangkan
  verifikasi alamat email memang belum ada. Kalimat itu perlu dipecah menjadi
  dua: satu untuk pemulihan sandi yang sudah jalan, satu untuk verifikasi email
  yang masih terbuka.

### 8. Judul dan bahasa di `docs/deployment.md`

Judulnya masih “Hosting the PostgreSQL starter”, padahal dokumen ini dipakai
repo turunan bernama Kelola Bimbel; dan satu paragraf terakhirnya (tentang
aturan penempatan murid) berbahasa Indonesia di tengah dokumen berbahasa
Inggris. Bukan langkah yang salah, tetapi pembaca perlu menebak apakah dokumen
ini masih dirawat.

## Yang sudah benar dan tidak perlu diubah

Diperiksa satu per satu dan masih cocok dengan kode/berkas sekarang:

- Perintah `npm run doctor` beserta keluarannya: label
  `✓ PostgreSQL connection and authentication tables` memang tulisan
  `scripts/doctor.mjs`.
- Nama resource, versi `postgres:17-alpine`, bentuk connection string internal,
  dan larangan membuka port database — sesuai panduan Coolify dan
  `scripts/coolify-db.mjs`.
- Lokasi `Dockerfile` (`aplikasi-manajemen-bimbel-offline-jurnal-mengajar/Dockerfile`)
  beserta target `runner` dan `migrator`; target `deps`/`builder`/`runtime` yang
  ada di berkasnya hanya tahap internal, bukan target yang dipilih di Coolify.
  Healthcheck memang memanggil `GET /icon.svg` dan hanya mengukur liveness.
- `MODE_RILIS`, `PENJADWAL_BACKUP`, `BACKUP_DIR` (bawaan `backups`), dan
  `RESTORE_COMMAND` (bawaan `pg_restore`) — semuanya cocok dengan
  `src/lib/mode-rilis.ts`, `src/services/backup.service.ts`, dan
  `src/lib/variabel-lingkungan.ts`. Penjelasan “salah tulis tidak membuat
  aplikasi gagal start” juga benar.
- Tabel “Masalah yang sering muncul”: seluruh barisnya masih menunjuk penyebab
  dan tindakan yang ada di kode (`force-dynamic` di layout terproteksi,
  `BETTER_AUTH_URL` sebagai origin, penolakan nama database yang sama pada uji
  pemulihan).
- Bagian pengembalian rilis (rollback) dan peringatan bahwa rollback tidak
  membatalkan migrasi — sesuai perilaku Coolify yang dijelaskan di dokumennya.
- `docs/local-development.md` sudah memuat pipa CI, perintah `npm run ci:wajib`,
  dan syarat merge-nya; tidak perlu diaudit ulang di Fase 4.
