# Peta data tiruan dan store peramban

Dokumen ini memetakan setiap penyimpanan peramban (`src/lib/*-store.ts`) dan
setiap data contoh (`src/lib/mock-*.ts`): siapa yang mengimpornya, apakah masih
dirender, dan padanan basis datanya. Peta ini dipakai untuk merencanakan
penyambungan sisa fitur ke API tanpa menebak-nebak lagi.

- Tanggal pemetaan: **2026-10-08**
- Cakupan: 2 berkas `*-store.ts` dan 12 berkas `mock-*.ts` (setelah
  `pengeluaran-store.ts`, `mock-pengeluaran.ts`, `presensi-guru-store.ts`, dan
  `mock-presensi-guru.ts` dilepas ke database).
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
grep -rn 'from "@/lib/tagihan-store"' src tests e2e scripts --include='*.ts' --include='*.tsx'

# 3. Impor mati: ESLint memakai @typescript-eslint/no-unused-vars (peringatan)
npm run lint

# 4. Ekspor tanpa pengimpor (per berkas), cocokkan dengan tabel di bawah
grep -rn "getTagihanPeriode" src   # contoh: hanya muncul di berkas mock-nya
```

Klasifikasi "hidup" divalidasi dengan melacak impor dari `src/app/**/page.tsx`
dan `layout.tsx` sampai ke berkas data; `npm run typecheck` menjaga agar tidak
ada rujukan yang putus.

## Berkas `*-store.ts`

| Berkas                               | Pengimpor (bukti `grep -n`)                                                                                                                                              | Klasifikasi | Catatan / padanan basis data                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/tagihan-store.ts`           | `src/components/arus-kas.tsx:17`<br>`src/components/beranda-portal-wali.tsx:20`<br>`src/components/laporan-laba-rugi.tsx:28`<br>`src/components/tagihan-spp-anak.tsx:15` | **Hidup**   | Dipakai 4 komponen (arus-kas, beranda portal wali, laba-rugi, tagihan SPP anak). **Duplikat**: `src/services/tagihan.service.ts` + `/api/tagihan` sudah memakai tabel `student_invoices`. Hanya fungsi baca (`langgananTagihan`, `siapkanTagihan`, `snapshotTagihan`) yang dipakai; lihat rekomendasi lanjutan. |
| `src/lib/jejak-baca-portal-store.ts` | `src/components/beranda-portal-wali.tsx:21`<br>`src/components/perkembangan-anak-portal.tsx:18`<br>`src/components/tagihan-spp-anak.tsx:18`                              | **Hidup**   | Jejak baca Portal Wali (lencana "Baru" pada kehadiran, catatan perkembangan, dan tagihan): waktu baca disimpan di `localStorage` per pasangan (anak, bagian). Padanan basis data: belum ada tabelnya — fase berikutnya mengganti isi modul dengan API/database, tampilan tidak berubah.                         |

## Berkas `mock-*.ts`

| Berkas                        | Pengimpor (bukti `grep -n`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Klasifikasi | Catatan / padanan basis data                                                                                                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/mock-akun.ts`        | `src/app/(auth)/masuk/page.tsx:3`<br>`src/components/daftar-guru.tsx:21`<br>`src/components/halaman-masuk.tsx:16`<br>`src/lib/mock-pengaturan.ts:9`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **Hidup**   | Auth nyata memakai Better Auth (`src/lib/auth.ts`, `/api/masuk`); daftar guru nyata lewat `src/services/pengaturan.service.ts` (`/api/pengaturan/guru`). Halaman masuk masih menampilkan daftar akun contoh.           |
| `src/lib/mock-cabang.ts`      | `src/components/daftar-cabang.tsx:19`<br>`src/components/daftar-kelas.tsx:26`<br>`src/components/form-tambah-cabang.tsx:15`<br>`src/components/form-tambah-kelas.tsx:14`<br>`src/components/form-ubah-kelas.tsx:7`<br>`src/services/cabang.service.ts:2`                                                                                                                                                                                                                                                                                                                                                  | **Hidup**   | Sudah ada layanan `src/services/cabang.service.ts` **dan** `/api/cabang`, tetapi layanan itu masih membaca sumber di berkas mock ini (lihat komentar di `src/services/cabang.service.ts:13`).                          |
| `src/lib/mock-gaji.ts`        | `src/app/(protected)/app/gaji/page.tsx:4`<br>`src/app/(protected)/app/gaji/riwayat/page.tsx:3`<br>`src/app/(protected)/app/gaji/saya/page.tsx:4`<br>`src/app/(protected)/app/gaji/slip/[guruId]/page.tsx:9`<br>`src/components/arus-kas.tsx:10`<br>`src/components/daftar-gaji-guru.tsx:12`<br>`src/components/laporan-laba-rugi.tsx:20`<br>`src/components/panel-rincian-jam.tsx:9`<br>`src/components/rekap-gaji-bulanan.tsx:17`<br>`src/components/rekap-gaji-saya.tsx:16`<br>`src/components/riwayat-gaji.tsx:16`<br>`src/components/slip-gaji.tsx:5`                                                 | **Hidup**   | Sudah ada `src/services/gaji.service.ts` (`/api/gaji`, `/api/admin/gaji`).                                                                                                                                             |
| `src/lib/mock-jurnal.ts`      | `src/app/(protected)/app/jurnal/page.tsx:3`<br>`src/app/(protected)/app/jurnal/riwayat/[id]/page.tsx:4`<br>`src/app/(protected)/app/jurnal/riwayat/page.tsx:3`<br>`src/components/daftar-kehadiran.tsx:16`<br>`src/components/daftar-riwayat-jurnal.tsx:17`<br>`src/components/detail-jurnal.tsx:30`<br>`src/components/jurnal-form.tsx:24`<br>`src/components/label-status-jurnal.tsx:2`<br>`src/components/pemilih-jadwal.tsx:13`<br>`src/components/pemilih-materi.tsx:13`<br>`src/components/perkembangan-anak-portal.tsx:12`<br>`src/lib/mock-portal-wali.ts:10`<br>`src/lib/ringkasan-cabang.ts:14` | **Hidup**   | Sudah ada `src/services/jurnal.service.ts`, `src/services/pemantauan.service.ts`, dan `src/services/jadwal.service.ts`.                                                                                                |
| `src/lib/mock-kelas.ts`       | `src/app/(protected)/app/kelas/page.tsx:3`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:4`<br>`src/app/(protected)/app/penempatan/page.tsx:3`<br>`src/components/daftar-cabang.tsx:18`<br>`src/components/daftar-kelas.tsx:27`<br>`src/components/daftar-penempatan.tsx:13`<br>`src/components/detail-murid.tsx:21`<br>`src/components/form-jadwal-kelas.tsx:7`<br>`src/components/form-tambah-kelas.tsx:15`<br>`src/components/form-ubah-kelas.tsx:8`<br>`src/lib/mock-penempatan.ts:7`<br>`src/lib/ringkasan-cabang.ts:13`                                                                      | **Hidup**   | Sudah ada `src/services/kelas.service.ts` (`/api/kelas`).                                                                                                                                                              |
| `src/lib/mock-menu.ts`        | `src/app/(protected)/layout.tsx:7`<br>`src/app/portal/layout.tsx:5`<br>`src/components/app-nav.tsx:6`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | **Hidup**   | Bukan data domain: menu navigasi per peran. Tidak punya padanan tabel.                                                                                                                                                 |
| `src/lib/mock-murid.ts`       | `src/app/(protected)/app/kelas/page.tsx:4`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:5`<br>`src/app/(protected)/app/murid/page.tsx:3`<br>`src/app/(protected)/app/penempatan/page.tsx:4`<br>`src/components/daftar-kelas.tsx:28`<br>`src/components/daftar-murid.tsx:12`<br>`src/components/daftar-penempatan.tsx:14`<br>`src/components/detail-murid.tsx:22`<br>`src/components/form-tambah-murid.tsx:14`<br>`src/components/panel-penempatan.tsx:17`<br>`src/lib/mock-portal-wali.ts:11`<br>`src/lib/mock-wali.ts:9`                                                                         | **Hidup**   | Sudah ada `src/services/murid.service.ts` (`/api/murid`).                                                                                                                                                              |
| `src/lib/mock-penempatan.ts`  | `src/app/(protected)/app/kelas/page.tsx:5`<br>`src/app/(protected)/app/murid/[muridId]/page.tsx:6`<br>`src/app/(protected)/app/penempatan/page.tsx:5`<br>`src/components/daftar-kelas.tsx:29`<br>`src/components/daftar-penempatan.tsx:15`<br>`src/components/detail-murid.tsx:23`<br>`src/lib/ringkasan-cabang.ts:15`                                                                                                                                                                                                                                                                                    | **Hidup**   | Tabel `student_enrollments` sudah ada (`src/db/schema/student-enrollments.ts`) dan dibaca `src/services/kelas.service.ts`; komentar di berkas mock masih bilang "belum ada".                                           |
| `src/lib/mock-pengaturan.ts`  | `src/app/(protected)/app/pengaturan/gaji/page.tsx:6`<br>`src/app/(protected)/app/pengaturan/guru/page.tsx:6`<br>`src/app/(protected)/app/pengaturan/profil/page.tsx:6`<br>`src/app/portal/layout.tsx:6`<br>`src/app/portal/page.tsx:3`<br>`src/components/beranda-portal-wali.tsx:18`<br>`src/components/form-aturan-gaji.tsx:18`<br>`src/components/form-profil-bimbel.tsx:23`<br>`src/components/laporan-laba-rugi.tsx:21`<br>`src/components/pengaturan-bimbel.tsx:19`<br>`src/components/rekap-gaji-bulanan.tsx:18`                                                                                   | **Hidup**   | Sudah ada `src/services/pengaturan.service.ts` (profil, tarif gaji, akun guru, preferensi notifikasi).                                                                                                                 |
| `src/lib/mock-portal-wali.ts` | `src/app/portal/page.tsx:4`<br>`src/app/portal/perkembangan/page.tsx:3`<br>`src/app/portal/tagihan/page.tsx:3`<br>`src/components/beranda-portal-wali.tsx:22`<br>`src/components/pemilih-anak.tsx:6`<br>`src/components/perkembangan-anak-portal.tsx:20`<br>`src/components/tagihan-spp-anak.tsx:19`<br>`src/lib/jejak-baca-portal-store.ts:20`                                                                                                                                                                                                                                                           | **Hidup**   | Portal wali menyusun anak/riwayat dari mock lain. Padanan data nyata: `src/services/murid.service.ts`, `src/services/jurnal.service.ts`, `src/services/perkembangan.service.ts`; belum ada layanan khusus portal wali. |
| `src/lib/mock-tagihan.ts`     | `src/lib/mock-portal-wali.ts:12`<br>`src/lib/tagihan-store.ts:8`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **Hidup**   | Sudah ada `src/services/tagihan.service.ts` + `/api/tagihan` yang memakai tabel `student_invoices`; berkas ini dipakai `tagihan-store.ts` dan `mock-portal-wali.ts` (tanggal tagihan untuk penanda "Baru").            |
| `src/lib/mock-wali.ts`        | `src/app/(protected)/app/pengaturan/wali/page.tsx:3`<br>`src/components/daftar-wali.tsx:6`<br>`src/components/pengaturan-bimbel.tsx:26`<br>`src/lib/mock-portal-wali.ts:12`                                                                                                                                                                                                                                                                                                                                                                                                                               | **Hidup**   | Sudah ada layanan pengaturan (`src/services/pengaturan.service.ts`) untuk akun/penautan wali.                                                                                                                          |

## Ekspor tanpa pengimpor (kandidat pembersihan lanjutan)

Tabel ini **tidak** dihapus pada pembersihan 2026-10-08 karena bukan impor mati
maupun berkas mati. Semuanya kandidat untuk dibersihkan bersama migrasi
fiturnya.

| Berkas                        | Ekspor tanpa pengimpor                                                                            | Catatan                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/lib/mock-akun.ts`        | `emailSudahDipakai`                                                                               | Tidak dipakai siapa pun; pengecekan email kini milik Better Auth/validasi API.                    |
| `src/lib/mock-jurnal.ts`      | `KehadiranMurid`, `KoreksiJurnal`                                                                 | Tipe sisa alur lama; koreksi jurnal kini lewat `src/services/jurnal.service.ts`.                  |
| `src/lib/mock-menu.ts`        | `MENU_PER_PERAN`                                                                                  | Hanya dipakai internal oleh `menuUntukPeran`/`menuUntukPortal`.                                   |
| `src/lib/mock-penempatan.ts`  | `KelasMurid`, `kelasMurid`                                                                        | Tidak ada pengimpor.                                                                              |
| `src/lib/mock-pengaturan.ts`  | `PreferensiNotifikasi`                                                                            | Tipe lama; komponen DB punya tipe sendiri di `src/services/pengaturan.service.ts`.                |
| `src/lib/mock-portal-wali.ts` | `CatatanPerkembangan`, `anakTertaut`                                                              | Hanya `anakTertautAtauPertama` yang dipakai halaman portal.                                       |
| `src/lib/mock-tagihan.ts`     | `getMuridTagihan`, `getPeriodeTagihanTersedia`, `getTagihanMurid`, `getTagihanPeriode`, `Tagihan` | Hanya `getSemuaTagihan` yang dipakai. `Tagihan` juga diimpor langsung dari `@/lib/tagihan`.       |
| `src/lib/mock-wali.ts`        | `WaliMurid`                                                                                       | Tipe lama.                                                                                        |
| `src/lib/tagihan-store.ts`    | `batalkanLunas`, `buatTagihanBaru`, `muridSudahDitagih`, `tandaiLunas`                            | Fungsi tulis/baca sisi-owner sudah digantikan `/api/tagihan` + `src/services/tagihan.service.ts`. |

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

Tidak ada **impor mati** yang ditemukan: `npm run lint` bersih sebelum dan
sesudah perubahan, dan aturan `@typescript-eslint/no-unused-vars` aktif
(peringatan) pada konfigurasi ESLint repo ini.

## Rekomendasi lanjutan (belum dikerjakan)

1. **`tagihan-store.ts` vs `tagihan.service.ts`.** Duplikat nyata: store peramban
   masih dipakai 4 komponen tampilan, sedangkan `/api/tagihan` +
   `src/services/tagihan.service.ts` sudah memakai tabel `student_invoices`.
   Pindahkan komponen ke data API, lalu hapus store beserta ekspor matinya
   (`buatTagihanBaru`, `tandaiLunas`, `batalkanLunas`, `muridSudahDitagih`) dan
   `src/lib/mock-tagihan.ts`. Beralasan: mengubah sumber data tampilan adalah
   perubahan perilaku, di luar lingkup pembersihan impor.
2. **Ekspor mati di tabel atas.** Bisa dihapus dalam perubahan kecil terpisah
   dari berkas yang masih hidup; sengaja tidak disatukan di sini.
3. **Komentar basi.** Beberapa berkas mock masih menulis "tabel belum ada"
   padahal skemanya sudah ada (`mock-penempatan.ts`, `mock-tagihan.ts`);
   perbarui saat migrasinya jalan.
