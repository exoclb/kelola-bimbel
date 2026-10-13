# Peta data tiruan dan store peramban

Dokumen ini memetakan setiap penyimpanan peramban (`src/lib/*-store.ts`) dan
setiap data contoh (`src/lib/mock-*.ts`): siapa yang mengimpornya, apakah masih
dirender, dan padanan basis datanya. Peta ini dipakai untuk merencanakan
penyambungan sisa fitur ke API tanpa menebak-nebak lagi.

- Tanggal pemetaan: **2026-10-08**; diperbarui **2026-10-09** (modul cabang
  pindah ke basis data) dan **2026-10-13** (modul backup menambah
  `src/lib/mock-backup.ts` — berkas itu kemudian dihapus karena jadwal backup
  sudah pindah ke tabel `backup_settings`).
- Cakupan: 1 berkas `*-store.ts` dan 10 berkas `mock-*.ts` (setelah
  `pengeluaran-store.ts`, `mock-pengeluaran.ts`, `presensi-guru-store.ts`,
  `mock-presensi-guru.ts`, `tagihan-store.ts`, `mock-portal-wali.ts`, dan
  `mock-tagihan.ts` dilepas ke database). Tipe Portal Wali yang dulu tinggal di
  `mock-portal-wali.ts` kini di `src/lib/portal-wali.ts` (murni tipe, tanpa data
  contoh).
- Klasifikasi:
  - **Hidup** — dipakai berkas yang benar-benar dirender. Jangan hapus.
  - **Impor mati** — berkas mengimpor sesuatu yang tidak pernah dipakai.
  - **Berkas mati** — tidak ada pengimpor sama sekali.

## Cara memverifikasi ulang

Semua klaim di bawah bisa dicek ulang. Dari akar repo:

```sh
# 1. Berkas mati: daftar mock yang tidak diimpor siapa pun
for f in src/lib/mock-*.ts; do
  mod="@/${f#src/}"; mod="${mod%.ts}"   # src/lib/x.ts -> @/lib/x
  n=$(grep -rl "from \"$mod\"" src tests e2e scripts --include='*.ts' --include='*.tsx' --include='*.mjs' 2>/dev/null | grep -v "^$f$" | wc -l)
  echo "$n  $f"
done

# 2. Pengimpor satu modul beserta nomor baris
grep -rn 'from "@/lib/mock-tagihan"' src tests e2e scripts --include='*.ts' --include='*.tsx'

# 3. Impor mati: ESLint memakai @typescript-eslint/no-unused-vars (peringatan)
npm run lint

# 4. Ekspor tanpa pengimpor (per berkas), cocokkan dengan tabel di bawah
grep -rn "getTagihanPeriode" src   # contoh: hanya muncul di berkas mock-nya
```

Klasifikasi "hidup" divalidasi dengan melacak impor dari `src/app/**/page.tsx`
dan `layout.tsx` sampai ke berkas data; `npm run typecheck` menjaga agar tidak
ada rujukan yang putus.

## Berkas `*-store.ts`

| Berkas                               | Pengimpor (bukti `grep -n`)                                                                                                                 | Klasifikasi | Catatan / padanan basis data                                                                                                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/jejak-baca-portal-store.ts` | `src/components/beranda-portal-wali.tsx:21`<br>`src/components/perkembangan-anak-portal.tsx:18`<br>`src/components/tagihan-spp-anak.tsx:18` | **Hidup**   | Jejak baca Portal Wali (lencana "Baru" pada kehadiran, catatan perkembangan, dan tagihan): modul ini hanya memanggil `GET/POST /api/jejak-baca`; status dibaca/dihitung server (`src/services/jejak-baca.service.ts`) dan disimpan di tabel `jejak_baca_portal`. |

## Berkas `mock-*.ts`

| Berkas                       | Pengimpor (bukti `grep -n`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Klasifikasi | Catatan / padanan basis data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/mock-akun.ts`       | `src/app/(auth)/masuk/page.tsx:3`<br>`src/components/daftar-guru.tsx:21`<br>`src/components/halaman-masuk.tsx:16`<br>`src/lib/mock-pengaturan.ts:9`                                                                                                                                                                                                                                                                                                                                                                                                       | **Hidup**   | Auth nyata memakai Better Auth (`src/lib/auth.ts`, `/api/masuk`); daftar guru nyata lewat `src/services/pengaturan.service.ts` (`/api/pengaturan/guru`). Halaman masuk masih menampilkan daftar akun contoh.                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/mock-cabang.ts`     | `scripts/seed-cabang.mjs:47` (dibaca lewat `pathToFileURL`, bukan alias `@/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Hidup**   | Sudah pindah ke basis data: tabel `cabang` (`src/db/schema/cabang.ts`, migrasi `0027_tabel_cabang.sql` + `0028_cabang_nama_unik.sql`) dibaca/ditulis `src/services/cabang.service.ts` dan `/api/cabang`. Berkas ini tinggal data awal untuk `npm run db:seed:cabang` (tanpa id tiruan; id dibuat tabel `cabang`), dan kelengkapan namanya dijaga `tests/data-cabang.test.mjs`. Komponen cabang tidak mengimpornya (dijaga aturan `no-restricted-imports` untuk `@/lib/mock-cabang` di `eslint.config.mjs`): datanya datang lewat prop dari halaman. |
| `src/lib/mock-gaji.ts`       | `src/app/(protected)/app/gaji/page.tsx:4`<br>`src/app/(protected)/app/gaji/riwayat/page.tsx:3`<br>`src/app/(protected)/app/gaji/saya/page.tsx:4`<br>`src/app/(protected)/app/gaji/slip/[guruId]/page.tsx:9`<br>`src/components/arus-kas.tsx:10`<br>`src/components/daftar-gaji-guru.tsx:12`<br>`src/components/laporan-laba-rugi.tsx:20`<br>`src/components/panel-rincian-jam.tsx:9`<br>`src/components/rekap-gaji-bulanan.tsx:17`<br>`src/components/rekap-gaji-saya.tsx:16`<br>`src/components/riwayat-gaji.tsx:16`<br>`src/components/slip-gaji.tsx:5` | **Hidup**   | Sudah ada `src/services/gaji.service.ts` (`/api/gaji`, `/api/admin/gaji`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/mock-jurnal.ts`     | `src/app/(protected)/app/jurnal/page.tsx:3`<br>`src/app/(protected)/app/jurnal/riwayat/[id]/page.tsx:4`<br>`src/app/(protected)/app/jurnal/riwayat/page.tsx:3`<br>`src/components/daftar-kehadiran.tsx:16`<br>`src/components/daftar-riwayat-jurnal.tsx:17`<br>`src/components/detail-jurnal.tsx:30`<br>`src/components/jurnal-form.tsx:24`<br>`src/components/label-status-jurnal.tsx:2`<br>`src/components/pemilih-jadwal.tsx:13`<br>`src/components/pemilih-materi.tsx:13`                                                                             | **Hidup**   | Sudah ada `src/services/jurnal.service.ts`, `src/services/pemantauan.service.ts`, dan `src/services/jadwal.service.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/lib/mock-kelas.ts`      | `scripts/seed-kelas.mjs` (dibaca lewat `pathToFileURL`, bukan alias `@/`)<br>`src/app/(protected)/app/kelas/page.tsx:3`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:4`<br>`src/app/(protected)/app/penempatan/page.tsx:3`<br>`src/components/daftar-kelas.tsx:27`<br>`src/components/daftar-penempatan.tsx:13`<br>`src/components/detail-murid.tsx:21`<br>`src/components/form-jadwal-kelas.tsx:7`<br>`src/components/form-tambah-kelas.tsx:15`<br>`src/components/form-ubah-kelas.tsx:8`<br>`src/lib/mock-penempatan.ts:7`                      | **Hidup**   | Sudah ada `src/services/kelas.service.ts` (`/api/kelas`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/mock-menu.ts`       | `src/app/(protected)/layout.tsx:7`<br>`src/app/portal/layout.tsx:5`<br>`src/components/app-nav.tsx:6`                                                                                                                                                                                                                                                                                                                                                                                                                                                     | **Hidup**   | Bukan data domain: menu navigasi per peran. Tidak punya padanan tabel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/lib/mock-murid.ts`      | `src/app/(protected)/app/kelas/page.tsx:4`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:5`<br>`src/app/(protected)/app/murid/page.tsx:3`<br>`src/app/(protected)/app/penempatan/page.tsx:4`<br>`src/components/daftar-kelas.tsx:28`<br>`src/components/daftar-murid.tsx:12`<br>`src/components/daftar-penempatan.tsx:14`<br>`src/components/detail-murid.tsx:22`<br>`src/components/form-tambah-murid.tsx:14`<br>`src/components/panel-penempatan.tsx:17`<br>`src/lib/mock-wali.ts:9`                                                             | **Hidup**   | Sudah ada `src/services/murid.service.ts` (`/api/murid`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/mock-penempatan.ts` | `src/app/(protected)/app/kelas/page.tsx:5`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:6`<br>`src/app/(protected)/app/penempatan/page.tsx:5`<br>`src/components/daftar-kelas.tsx:29`<br>`src/components/daftar-penempatan.tsx:15`<br>`src/components/detail-murid.tsx:23`                                                                                                                                                                                                                                                                        | **Hidup**   | Tabel `student_enrollments` sudah ada (`src/db/schema/student-enrollments.ts`) dan dibaca `src/services/kelas.service.ts`; komentar di berkas mock masih bilang "belum ada".                                                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/mock-pengaturan.ts` | `src/app/(protected)/app/pengaturan/gaji/page.tsx:6`<br>`src/app/(protected)/app/pengaturan/guru/page.tsx:6`<br>`src/app/(protected)/app/pengaturan/profil/page.tsx:6`<br>`src/app/portal/layout.tsx:6`<br>`src/app/portal/page.tsx:3`<br>`src/components/beranda-portal-wali.tsx:18`<br>`src/components/form-aturan-gaji.tsx:18`<br>`src/components/form-profil-bimbel.tsx:23`<br>`src/components/laporan-laba-rugi.tsx:21`<br>`src/components/pengaturan-bimbel.tsx:19`<br>`src/components/rekap-gaji-bulanan.tsx:18`                                   | **Hidup**   | Sudah ada `src/services/pengaturan.service.ts` (profil, tarif gaji, akun guru, preferensi notifikasi).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/lib/mock-wali.ts`       | `src/app/(protected)/app/pengaturan/wali/page.tsx:3`<br>`src/components/daftar-wali.tsx:6`<br>`src/components/pengaturan-bimbel.tsx:26`                                                                                                                                                                                                                                                                                                                                                                                                                   | **Hidup**   | Sudah ada layanan pengaturan (`src/services/pengaturan.service.ts`) untuk akun/penautan wali.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Ekspor tanpa pengimpor (kandidat pembersihan lanjutan)

Tabel ini **tidak** dihapus pada pembersihan 2026-10-08 karena bukan impor mati
maupun berkas mati. Semuanya kandidat untuk dibersihkan bersama migrasi
fiturnya.

| Berkas                       | Ekspor tanpa pengimpor            | Catatan                                                                            |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| `src/lib/mock-akun.ts`       | `emailSudahDipakai`               | Tidak dipakai siapa pun; pengecekan email kini milik Better Auth/validasi API.     |
| `src/lib/mock-jurnal.ts`     | `KehadiranMurid`, `KoreksiJurnal` | Tipe sisa alur lama; koreksi jurnal kini lewat `src/services/jurnal.service.ts`.   |
| `src/lib/mock-menu.ts`       | `MENU_PER_PERAN`                  | Hanya dipakai internal oleh `menuUntukPeran`/`menuUntukPortal`.                    |
| `src/lib/mock-penempatan.ts` | `KelasMurid`, `kelasMurid`        | Tidak ada pengimpor.                                                               |
| `src/lib/mock-pengaturan.ts` | `PreferensiNotifikasi`            | Tipe lama; komponen DB punya tipe sendiri di `src/services/pengaturan.service.ts`. |
| `src/lib/mock-wali.ts`       | `WaliMurid`                       | Tipe lama.                                                                         |

## Yang sudah dibersihkan (2026-10-08)

- `src/lib/pengeluaran-store.ts` dan `src/lib/mock-pengeluaran.ts` — modul
  pengeluaran operasional pindah ke basis data: tabel `expenses` +
  `expense_categories` dibaca/ditulis `src/services/pengeluaran.service.ts`,
  `/api/pengeluaran` (+ `[id]`, `/kategori`), validator
  `src/validators/pengeluaran.ts`, dan halaman `/app/pengeluaran`,
  `/app/arus-kas`, `/app/laba-rugi`. Kedua berkas penyimpanan peramban dihapus
  karena sudah nol pengimpor.
- `src/lib/mock-kehadiran.ts` (50 baris, sha1 `323c021e5b30166a0e0ffa70e5baf8cb502bb11b`)
  — **berkas mati**: nol pengimpor di `src/`, `tests/`, `e2e/`, dan `scripts/`.
  Satu-satunya rujukan tersisa hanya di `tsconfig.tsbuildinfo` dan
  `.ngodingpakeai/summaries.json` (artefak build, bukan kode).
  Ekspornya (`KehadiranPertemuan`, `getKehadiranAwal`) tidak dipakai di mana pun.
- `src/lib/tagihan-store.ts` — sisi tagihan pindah ke basis data: `arus-kas`,
  `laba-rugi`, beranda portal wali, dan tagihan SPP anak kini menerima angka
  dari `src/services/tagihan.service.ts` lewat prop halaman server
  (`rekapPemasukanPeriode`, `listTagihanMurid`). Berkas store dihapus karena
  sudah nol pengimpor; sisi honor guru masih mock (`src/lib/mock-gaji.ts`).
- `src/lib/mock-portal-wali.ts` dan `src/lib/mock-tagihan.ts` — isi per anak di
  Portal Wali pindah ke basis data: catatan dari `student_progress`, kehadiran
  dari `journal_attendances` → `teaching_journals`, tagihan dari
  `student_invoices`, dan waktu baca dari `jejak_baca_portal`. Pembacaannya
  lewat `src/services/portal.service.ts` (`muatIsiPortalWali`, `bagianPortalAnak`)
  yang memakai ulang `listCatatanPerkembanganAnak` (perkembangan.service),
  `listKehadiranAnak` (kehadiran.service), dan `listTagihanMurid`
  (tagihan.service). Kedua berkas mock dihapus karena sudah nol pengimpor;
  tipe yang dulu tinggal di sana kini di `src/lib/portal-wali.ts` (murni tipe).
  Jembatan id `idMuridTiruan` di `src/lib/id-murid.mjs` ikut dihapus karena
  tinggal `idMuridDb` yang dipakai seeder penautan wali.

Tidak ada **impor mati** yang ditemukan: `npm run lint` bersih sebelum dan
sesudah perubahan, dan aturan `@typescript-eslint/no-unused-vars` aktif
(peringatan) pada konfigurasi ESLint repo ini.

## Yang sudah dibersihkan (2026-10-09)

- Modul cabang pindah dari data tiruan tingkat proses ke tabel basis data:
  tabel `cabang` (`src/db/schema/cabang.ts`, migrasi `0027_tabel_cabang.sql`
  dan `0028_cabang_nama_unik.sql`) dibaca/ditulis `src/services/cabang.service.ts`
  (`/api/cabang` dan `/api/cabang/[id]`, validasi `src/validators/cabang.ts`),
  dan `src/lib/ringkasan-cabang.ts` kini menghitung kelas, murid, dan jurnal per
  cabang dari tabel `classes`, `student_enrollments`, dan `teaching_journals`.
  Karena sumbernya basis data, `src/components/daftar-cabang.tsx` tidak lagi
  menampilkan catatan "data tiruan di memori server", dan catatan "data tiruan"
  di halaman pantauan dihapus (seluruh isinya sudah dari basis data).
- Penyimpanan proses di `src/lib/mock-cabang.ts` (`penyimpananCabang`,
  `tambahCabangTiruan`, `gantiCabangTiruan`, `ringkasCabang`) dihapus karena
  tidak ada lagi pengimpornya; berkas itu kini hanya menyimpan data awal yang
  dibaca `scripts/seed-cabang.mjs` (`npm run db:seed:cabang`, idempoten lewat
  `INSERT ... ON CONFLICT DO NOTHING` pada nama yang tak peka huruf besar-kecil).
- Tipe `Cabang` ikut pindah ke `src/services/cabang.service.ts` (mengikuti pola
  `src/services/wali.service.ts`); lima komponen kelas/cabang yang dulu
  mengimpor tipe itu dari `src/lib/mock-cabang.ts` sekarang mengimpornya dari
  layanan tersebut.

## Aksi yang belum tersambung ke server

Di luar kedua tabel di atas, ada aksi antarmuka yang sudah tampil tetapi belum
memanggil server, sehingga tidak punya berkas data contoh:

- `src/components/aksi-jalankan-backup.tsx` — tombol "Jalankan backup sekarang"
  di halaman Pengaturan → Backup Database. Fungsi `jalankanBackup()` di berkas
  itu masih menirukan prosesnya di layar; proses sungguhannya berjalan lewat
  `npm run db:backup` di server dan catatannya belum bertambah di riwayat
  (`backup_runs`). Sambungkan fungsi itu ke endpoint backup saat sudah ada.

## Rekomendasi lanjutan (belum dikerjakan)

1. **Ekspor mati di tabel atas.** Bisa dihapus dalam perubahan kecil terpisah
   dari berkas yang masih hidup; sengaja tidak disatukan di sini.
2. **Komentar basi.** Beberapa berkas mock masih menulis "tabel belum ada"
   padahal skemanya sudah ada (`mock-penempatan.ts`); perbarui saat migrasinya
   jalan.
