# Peta data tiruan dan store peramban

Dokumen ini memetakan setiap penyimpanan peramban (`src/lib/*-store.ts`) dan
setiap data contoh (`src/lib/mock-*.ts`): siapa yang mengimpornya, apakah masih
dirender, dan padanan basis datanya. Peta ini dipakai untuk merencanakan
penyambungan sisa fitur ke API tanpa menebak-nebak lagi.

- Tanggal pemetaan: **2026-10-08**; diperbarui **2026-10-09** (modul cabang
  pindah ke basis data) dan **2026-10-10** (formulir jurnal mengajar pindah ke
  basis data; formulir tambah dan ubah murid kini berbagi aturan di
  `src/lib/murid.ts`, murni tanpa data contoh; daftar murid menambah penyaring
  cabang/kelas yang membaca kelas + penempatan lewat prop halaman; halaman
  honor/gaji pindah ke basis data — `src/lib/mock-gaji.ts` dilepas dan tipe
  murninya kini di `src/lib/gaji.ts`; formulir tarif honor pindah ke basis data
  — riwayat `salary_settings` kini dibaca halaman dan disimpan lewat
  `POST /api/pengaturan/gaji`).
- Cakupan: 1 berkas `*-store.ts` dan 9 berkas `mock-*.ts` (setelah
  `pengeluaran-store.ts`, `mock-pengeluaran.ts`, `presensi-guru-store.ts`,
  `mock-presensi-guru.ts`, `tagihan-store.ts`, `mock-portal-wali.ts`,
  `mock-tagihan.ts`, dan `mock-gaji.ts` dilepas ke database). Tipe Portal Wali
  yang dulu tinggal di `mock-portal-wali.ts` kini di `src/lib/portal-wali.ts`
  (murni tipe, tanpa data contoh), dan tipe honor yang dulu tinggal di
  `mock-gaji.ts` kini di `src/lib/gaji.ts`.
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

| Berkas                       | Pengimpor (bukti `grep -n`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Klasifikasi | Catatan / padanan basis data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/mock-akun.ts`       | `src/app/(auth)/masuk/page.tsx:3`<br>`src/components/daftar-guru.tsx:21`<br>`src/components/halaman-masuk.tsx:16`<br>`src/lib/mock-pengaturan.ts:9`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Hidup**   | Auth nyata memakai Better Auth (`src/lib/auth.ts`, `/api/masuk`); daftar guru nyata lewat `src/services/pengaturan.service.ts` (`/api/pengaturan/guru`). Halaman masuk masih menampilkan daftar akun contoh.                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/mock-cabang.ts`     | `scripts/seed-cabang.mjs:47` (dibaca lewat `pathToFileURL`, bukan alias `@/`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **Hidup**   | Sudah pindah ke basis data: tabel `cabang` (`src/db/schema/cabang.ts`, migrasi `0027_tabel_cabang.sql` + `0028_cabang_nama_unik.sql`) dibaca/ditulis `src/services/cabang.service.ts` dan `/api/cabang`. Berkas ini tinggal data awal untuk `npm run db:seed:cabang` (tanpa id tiruan; id dibuat tabel `cabang`), dan kelengkapan namanya dijaga `tests/data-cabang.test.mjs`. Komponen cabang tidak mengimpornya (dijaga aturan `no-restricted-imports` untuk `@/lib/mock-cabang` di `eslint.config.mjs`): datanya datang lewat prop dari halaman.                                            |
| `src/lib/mock-jurnal.ts`     | `src/app/(protected)/app/jurnal/riwayat/[id]/page.tsx:4`<br>`src/app/(protected)/app/jurnal/riwayat/page.tsx:7`<br>`src/components/daftar-riwayat-jurnal.tsx:17`<br>`src/components/detail-jurnal.tsx:34`<br>`src/components/label-status-jurnal.tsx:2`                                                                                                                                                                                                                                                                                                                                                                    | **Hidup**   | Isi jurnal sudah pindah ke basis data (`src/services/jurnal.service.ts`, `POST /api/jurnal`): halaman `app/jurnal/page.tsx` membaca jadwal hari ini lewat `src/services/presensi-guru.service.ts` dan jurnal tersimpan lewat `listJurnalGuruTanggal`, sedangkan `jurnal-form.tsx`, `pemilih-jadwal.tsx`, `daftar-kehadiran.tsx`, dan `pemilih-materi.tsx` tidak lagi mengimpornya. Berkas ini tinggal riwayat/detail (`getRiwayatJurnal`, `getJurnalById`, `koreksiJurnalStub`); padanan basis datanya sudah ada di `src/services/pemantauan.service.ts` dan `src/services/jurnal.service.ts`. |
| `src/lib/mock-kelas.ts`      | `scripts/seed-kelas.mjs` (dibaca lewat `pathToFileURL`, bukan alias `@/`)<br>`src/app/(protected)/app/kelas/page.tsx:3`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:4`<br>`src/app/(protected)/app/murid/page.tsx:3`<br>`src/app/(protected)/app/penempatan/page.tsx:3`<br>`src/components/daftar-kelas.tsx:27`<br>`src/components/daftar-murid.tsx:21`<br>`src/components/daftar-penempatan.tsx:13`<br>`src/components/detail-murid.tsx:22`<br>`src/components/form-jadwal-kelas.tsx:7`<br>`src/components/form-tambah-kelas.tsx:15`<br>`src/components/form-ubah-kelas.tsx:8`<br>`src/lib/mock-penempatan.ts:7` | **Hidup**   | Sudah ada `src/services/kelas.service.ts` (`/api/kelas`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/mock-menu.ts`       | `src/app/(protected)/layout.tsx:7`<br>`src/app/portal/layout.tsx:5`<br>`src/components/app-nav.tsx:6`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **Hidup**   | Bukan data domain: menu navigasi per peran. Tidak punya padanan tabel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/mock-murid.ts`      | `src/app/(protected)/app/kelas/page.tsx:4`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:5`<br>`src/app/(protected)/app/murid/page.tsx:4`<br>`src/app/(protected)/app/penempatan/page.tsx:4`<br>`src/components/daftar-kelas.tsx:28`<br>`src/components/daftar-murid.tsx:20`<br>`src/components/daftar-penempatan.tsx:14`<br>`src/components/detail-murid.tsx:23`<br>`src/components/form-tambah-murid.tsx:8`<br>`src/components/form-ubah-murid.tsx:8`<br>`src/components/panel-penempatan.tsx:18`<br>`src/lib/mock-wali.ts:9`<br>`src/lib/murid.ts:10`                                                            | **Hidup**   | Sudah ada `src/services/murid.service.ts` (`/api/murid`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/lib/mock-penempatan.ts` | `src/app/(protected)/app/kelas/page.tsx:5`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:6`<br>`src/app/(protected)/app/murid/page.tsx:5`<br>`src/app/(protected)/app/penempatan/page.tsx:5`<br>`src/components/daftar-kelas.tsx:29`<br>`src/components/daftar-murid.tsx:22`<br>`src/components/daftar-penempatan.tsx:15`<br>`src/components/detail-murid.tsx:24`<br>`src/lib/murid.ts:12`                                                                                                                                                                                                                          | **Hidup**   | Tabel `student_enrollments` sudah ada (`src/db/schema/student-enrollments.ts`) dan dibaca `src/services/kelas.service.ts`; komentar di berkas mock masih bilang "belum ada".                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/lib/mock-pengaturan.ts` | `src/app/(protected)/app/pengaturan/guru/page.tsx:6`<br>`src/components/pengaturan-bimbel.tsx:24`                                                                                                    | **Hidup**   | Tarif honor sudah pindah ke basis data: halaman Aturan Gaji membaca riwayat tabel `salary_settings` lewat `ambilAturanGaji` dan menyimpannya lewat `POST /api/pengaturan/gaji`, sedangkan kartu ringkasannya memakai `aturanGajiBerlaku` (aturan tarifnya sendiri ada di `src/lib/gaji.ts`). Sisa berkas ini: daftar akun guru (padanannya `src/services/pengaturan.service.ts`, `/api/pengaturan/guru`) dan preferensi notifikasi.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/lib/mock-wali.ts`       | `src/app/(protected)/app/pengaturan/wali/page.tsx:3`<br>`src/components/daftar-wali.tsx:6`<br>`src/components/pengaturan-bimbel.tsx:26`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | **Hidup**   | Sudah ada layanan pengaturan (`src/services/pengaturan.service.ts`) untuk akun/penautan wali.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Ekspor tanpa pengimpor (kandidat pembersihan lanjutan)

Tabel ini **tidak** dihapus pada pembersihan 2026-10-08 karena bukan impor mati
maupun berkas mati. Semuanya kandidat untuk dibersihkan bersama migrasi
fiturnya.

| Berkas                       | Ekspor tanpa pengimpor     | Catatan                                                                                                                                                                                              |
| ---------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/mock-akun.ts`       | `emailSudahDipakai`        | Tidak dipakai siapa pun; pengecekan email kini milik Better Auth/validasi API.                                                                                                                       |
| `src/lib/mock-jurnal.ts`     | `KoreksiJurnal`            | Hanya dipakai internal oleh `koreksiJurnalStub` (riwayat/detail masih mock); koreksi jurnal nyata lewat `src/services/jurnal.service.ts`. Tipe `KehadiranMurid` sudah pindah ke `src/lib/jurnal.ts`. |
| `src/lib/mock-menu.ts`       | `MENU_PER_PERAN`           | Hanya dipakai internal oleh `menuUntukPeran`/`menuUntukPortal`.                                                                                                                                      |
| `src/lib/mock-penempatan.ts` | `KelasMurid`, `kelasMurid` | Tidak ada pengimpor.                                                                                                                                                                                 |
| `src/lib/mock-pengaturan.ts` | `PreferensiNotifikasi`     | Tipe lama; komponen DB punya tipe sendiri di `src/services/pengaturan.service.ts`.                                                                                                                   |
| `src/lib/mock-wali.ts`       | `WaliMurid`                | Tipe lama.                                                                                                                                                                                           |

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
  sudah nol pengimpor; sisi honor guru ikut pindah ke basis data: halaman
  rekap, riwayat, gaji sendiri, dan slip membaca `rekapGajiAnyBulanan`,
  `riwayatGajiAny`, `rekapGajiGuru`, dan `rekapGajiAnyGuru` dari
  `src/services/gaji.service.ts`, sedangkan penandaan pembayaran dikirim ke
  `PATCH /api/admin/gaji` lalu halaman disegarkan ulang (bukan lagi disimpan di
  state komponen). Tipe angka yang dipakai bersama klien dan server pindah ke
  `src/lib/gaji.ts` (`StatusPembayaran`, `RincianJam`, `BarisRekapGaji`,
  `RekapGaji`, `RingkasanGajiBulanan`), dan `src/lib/mock-gaji.ts` dihapus karena
  sudah nol pengimpor.
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

## Yang sudah dibersihkan (2026-10-10)

- Formulir tarif honor pindah dari data tiruan ke basis data. Halaman
  `/app/pengaturan/gaji` kini membaca riwayat tarif tabel `salary_settings`
  lewat `ambilAturanGaji` dan menyerahkannya sebagai prop, lalu formulirnya
  menyimpan lewat `POST /api/pengaturan/gaji` (tanggal yang sudah dipakai
  dijawab `409 TANGGAL_SUDAH_ADA`) dan menyegarkan halamannya — jadi daftar
  riwayat, penanda "Berlaku sekarang", dan kartu ringkasan di `/app/pengaturan`
  sama dengan isi tabelnya. Karena itu `getRiwayatTarif`, `getAturanGaji`, dan
  konstanta `RIWAYAT_TARIF` dihapus dari `src/lib/mock-pengaturan.ts` (sisanya
  daftar akun guru dan preferensi notifikasi yang masih tiruan).
- Aturan "tarif mana yang berlaku pada tanggal ini" dikumpulkan jadi satu
  fungsi murni `aturanTarifBerlaku` di `src/lib/gaji.ts`, dipakai layar
  pengaturan (menandai baris yang berlaku) sekaligus `tarifPadaAkhirPeriode`
  saat menghitung rekap gaji — supaya keduanya tidak bisa berbeda. Tipe
  `AturanTarif` juga tinggal di berkas murni itu, dan `AturanGajiTersimpan` di
  `src/services/pengaturan.service.ts` kini aliasnya.
- Formulir jurnal mengajar pindah dari data tiruan ke basis data. Halaman
  `/app/jurnal` kini membaca jadwal hari ini milik akun yang sedang masuk
  (`listSesiPresensiGuru` di `src/services/presensi-guru.service.ts`) plus jurnal
  yang sudah tersimpan hari itu (`listJurnalGuruTanggal` di
  `src/services/jurnal.service.ts`), lalu menyerahkannya sebagai prop; formnya
  mengirim `POST /api/jurnal` lewat `pesanGalatApi` seperti form lain, sehingga
  sesi yang dikirim ulang memperbarui baris `teaching_journals` yang sama
  (idempoten) dan kehadirannya dibatasi murid kelas itu (`journal_attendances`).
  Sesi yang sudah diisi dimuat ulang apa adanya dengan penanda "sudah diisi hari
  ini", jadi mengisi ulang tidak menghapus kehadiran yang sudah dicatat.
- Tipe dan helper murni jurnal pindah dari `src/lib/mock-jurnal.ts` ke
  `src/lib/jurnal.ts` (`MuridKelas`, `Jadwal`, `KehadiranMurid`, `JurnalInput`,
  `PILIHAN_MATERI`, `pisahMateri`), mengikuti pola `src/lib/portal-wali.ts`:
  halaman nyata tidak lagi mengimpor berkas mock hanya untuk tipe atau konstanta.
  `src/lib/mock-jurnal.ts` kini hanya menyimpan riwayat/detail tiruan
  (`getRiwayatJurnal`, `getKelasRiwayat`, `getJurnalById`, `koreksiJurnalStub`)
  beserta tipenya, dan datanya masih dipakai `tests/data-cabang.test.mjs` untuk
  daftar cabang.

## Rekomendasi lanjutan (belum dikerjakan)

1. **Ekspor mati di tabel atas.** Bisa dihapus dalam perubahan kecil terpisah
   dari berkas yang masih hidup; sengaja tidak disatukan di sini.
2. **Komentar basi.** Beberapa berkas mock masih menulis "tabel belum ada"
   padahal skemanya sudah ada (`mock-penempatan.ts`); perbarui saat migrasinya
   jalan.
