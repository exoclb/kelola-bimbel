# Penempatan Murid (Multi-Kelas)

Dokumen ini menggantikan aturan lama "satu murid hanya boleh berada di satu kelas
aktif". Sejak perubahan ini, **seorang murid boleh aktif di beberapa kelas
sekaligus** — misalnya kelas matematika dan kelas bahasa, atau kelas tambahan
persiapan ujian — dengan jadwal maupun guru pengampu yang berbeda.

## Aturan

1. **Boleh multi-kelas.** Menambahkan murid ke kelas lain langsung diterima;
   tidak perlu mengeluarkannya dari kelas lama.
2. **Unik per pasangan murid–kelas.** Penempatan kedua di **kelas yang sama**
   ditolak 409 `SUDAH_TERDAFTAR` dengan pesan
   `Murid ini sudah terdaftar di kelas ini.` Penjaganya adalah indeks unik
   parsial `student_enrollments_student_kelas_aktif_idx`
   (`student_id, class_id` WHERE `status = 'aktif'`), jadi dua permintaan
   bersamaan pun tidak bisa menyisipkan baris dobel.
3. **Riwayat tetap utuh.** Keluar dari kelas menandai penempatannya `selesai`,
   bukan menghapus barisnya. Kelas lain yang sedang diikuti tidak terpengaruh.
4. **Boleh kembali.** Murid yang pernah keluar dari sebuah kelas boleh
   ditempatkan lagi di kelas itu (baris baru berstatus `aktif`), jadi kelas yang
   riwayatnya sudah `selesai` tetap ikut ditawarkan di halaman detail murid.
5. **Cabang harus siap dipakai.** Kelas di **cabang nonaktif** dan kelas yang
   **cabangnya belum terdaftar** (namanya berubah atau baris cabangnya terhapus)
   tidak dipakai untuk penempatan baru; kelas yang sudah berjalan tetap dibuka
   sampai muridnya keluar. Aturan ini dipakai halaman detail murid
   (`/app/murid/<id>`) yang menawarkan kelas lintas cabang; panel kelas di
   `/app/kelas` sengaja tidak memeriksanya karena kelasnya sudah terbuka di
   layar.

## Alur di aplikasi

| Lokasi            | Yang bisa dilakukan                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/kelas`      | Panel "Murid di kelas ini": pilih murid lalu "Masukkan ke kelas"; tombol "Keluarkan" per murid untuk kelas itu saja. Pilihan muridnya hanya berisi murid **aktif** yang belum ada di kelas itu; kalau penempatan tetap ditolak (murid nonaktif atau sudah terdaftar), alasannya muncul sebagai kotak peringatan **di dalam panel kelas yang bersangkutan**, bukan di kepala halaman.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/app/murid`      | Saringan **status** (semua / hanya aktif / hanya tidak aktif), **cabang**, dan **kelas** di samping pencarian, ringkasan "N dari M murid cocok …", dan tiap kartu punya tautan "Detail murid". Pilihan cabang/kelasnya hanya yang masih berisi murid aktif (kelas yang seluruh penempatannya sudah `selesai` tidak ditawarkan), memilih cabang mempersempit pilihan kelasnya, dan tiap kartu menyebut kelas + cabang yang sedang diikuti. Murid nonaktif ditandai pil "Tidak aktif".                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `/app/murid/<id>` | Daftar **kelas yang sedang diikuti** (dengan tombol "Keluarkan dari kelas ini"), pilihan **"Tambah ke kelas lain"** (kelas yang belum aktif), dan **riwayat kelas** yang sudah selesai. Pilihan kelasnya dikosongkan dulu ("Pilih kelas…"), tombolnya baru hidup setelah satu kelas dipilih, dan setelah tersimpan pilihannya kosong lagi — jadi klik beruntun tidak bisa menempatkan murid ke kelas yang tidak dimaksud. Penempatannya diperiksa Aturan 2 di bawah: murid nonaktif, kelas duplikat, dan kelas di **cabang nonaktif atau belum terdaftar** ditolak dengan alasannya di layar (kelas seperti itu tetap terlihat dengan tanda "(cabang nonaktif)" supaya alasannya terbaca). Tombol **"Ubah data murid"** di bawah rangkuman identitasnya membuka formulir yang sama dengan halaman daftar (nama, tanggal lahir, orang tua, dan status aktif), lalu kepala halaman, pil status, dan baris kontaknya ikut berubah. |
| `/app/penempatan` | Daftar penempatan **dikelompokkan per kelas**: tiap kelas punya kepala (nama kelas, cabang, guru, jumlah murid) berisi daftar muridnya, termasuk baris berstatus `selesai` sebagai riwayat ("Pernah diikuti sejak …"). Ringkasan "N penempatan · M aktif · K murid aktif di lebih dari satu kelas", saringan status, dan pencarian nama murid/kelas/cabang/guru tetap di atas daftar; kelas yang tidak punya baris cocok ikut hilang.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## API

- `GET /api/kelas/:id/murid` — murid yang **sedang** di kelas itu.
- `POST /api/kelas/:id/murid` — `{ muridId, tanggalMulai? }`, 201 dengan daftar
  murid terbaru kelas itu; 409 kalau murid sudah aktif di kelas yang sama.
- `DELETE /api/kelas/:id/murid/:muridId` — menandai penempatan `selesai`
  (404 kalau murid memang tidak sedang di kelas itu).
- `GET /api/kelas` — setiap kelas memuat `jumlahMurid` (penempatan aktifnya).

- `GET /api/kelas/:id/murid?status=semua` — daftar kelas itu termasuk penempatan yang sudah `selesai`.
- `GET /api/penempatan?muridId=&kelasId=&status=` — riwayat penempatan lintas kelas; `meta.aktif` menghitung yang masih berjalan.

## Dampak ke laporan

Karena kehadiran dan perkembangan melekat pada murid (bukan pada satu kelas),
catatan dari semua kelas yang diikuti otomatis tergabung:

- `GET /api/kehadiran?muridId=` → sesi dari seluruh kelas murid; `meta`
  memuat `hadir` dan `tidakHadir` dari semua kelas itu.
- `GET /api/perkembangan/ringkasan?muridId=` → `jumlahPertemuan` dan
  `jumlahHadir` gabungan, plus rata-rata nilai dari semua catatan.
- `GET /api/perkembangan/riwayat?muridId=` → bundel laporan: murid, ringkasan,
  catatan, dan kehadiran lengkap.
- Halaman riwayat dan laporan menampilkan **kelas tiap sesi kehadiran** supaya
  sesi dari kelas berbeda tidak tertukar.

## Migrasi

Aturan baru dibawa oleh migrasi `0014_penempatan_multi_kelas.sql`:

```sql
DROP INDEX "student_enrollments_student_aktif_idx";
CREATE UNIQUE INDEX "student_enrollments_student_kelas_aktif_idx"
  ON "student_enrollments" USING btree ("student_id","class_id")
  WHERE "student_enrollments"."status" = 'aktif';
```

Tidak ada baris yang diubah, jadi riwayat penempatan lama tetap apa adanya.
Migrasi berjalan lewat target `migrator` image produksi sebelum aplikasi start
(lihat `docs/deployment.md`); uji perilakunya ada di
`e2e/penempatan.spec.ts` (alur lengkap lewat API: multi-kelas, penolakan
penempatan dobel, keluar dari satu kelas saja, dan kembali setelah keluar),
`e2e/api-penempatan.spec.ts` (kontrak HTTP endpointnya: 401 tanpa sesi, 403
untuk permintaan tanpa origin, 404/422 untuk id dan isian yang tidak sah,
pencatatan `tanggalMulai`, serta penjaga duplikatnya diuji dengan dua permintaan
bersamaan), `e2e/panel-penempatan.spec.ts` (panel
"Murid di kelas ini" di `/app/kelas`, yang masih data tiruan), dan
`e2e/murid-daftar.spec.ts` (penyaring cabang/kelas halaman daftar murid, yang
juga masih data tiruan), `e2e/murid-penempatan.spec.ts` (penolakan penempatan di
halaman detail murid: cabang nonaktif, murid nonaktif, dan pemilihan kelas yang
tidak bisa dobel), dan dijalankan lebih dulu di database uji.

Aturan penolakan di layar dipusatkan di `src/lib/penempatan-kelas.ts`
(`periksaPenempatan`, `penghalangCabang`, `kelasBelumDiikuti`) supaya halaman
detail murid dan panel kelas memakai pemeriksaan yang sama dengan pesan yang
sama; pesannya sendiri mengikuti 409 `MURID_TIDAK_AKTIF` dan `SUDAH_TERDAFTAR`
milik `src/services/kelas.service.ts`. Unit testnya ada di
`tests/penempatan-kelas.test.mjs`.

## Yang masih data tiruan

Halaman `/app/kelas`, `/app/murid`, `/app/murid/<id>`, dan `/app/penempatan`
masih memakai data contoh di layar (lihat `src/lib/mock-penempatan.ts`).
Penyambungan penuh ke API penempatan menyusul; aturan di dokumen ini sudah
berlaku di API, service, dan basis data.
