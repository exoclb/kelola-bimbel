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
   ditempatkan lagi di kelas itu (baris baru berstatus `aktif`).

## Alur di aplikasi

| Lokasi            | Yang bisa dilakukan                                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app/kelas`      | Panel "Murid di kelas ini": pilih murid lalu "Masukkan ke kelas"; tombol "Keluarkan" per murid untuk kelas itu saja.                                                                    |
| `/app/murid`      | Tiap kartu punya tautan "Detail murid".                                                                                                                                                 |
| `/app/murid/<id>` | Daftar **kelas yang sedang diikuti** (dengan tombol "Keluarkan dari kelas ini"), pilihan **"Tambah ke kelas lain"** (kelas yang belum aktif), dan **riwayat kelas** yang sudah selesai. |
| `/app/penempatan` | Daftar seluruh penempatan lintas kelas: ringkasan "N penempatan · M aktif · K murid aktif di lebih dari satu kelas", saringan status, dan pencarian nama murid/kelas/cabang/guru.       |

## API

- `GET /api/kelas/:id/murid` — murid yang **sedang** di kelas itu.
- `POST /api/kelas/:id/murid` — `{ muridId, tanggalMulai? }`, 201 dengan daftar
  murid terbaru kelas itu; 409 kalau murid sudah aktif di kelas yang sama.
- `DELETE /api/kelas/:id/murid/:muridId` — menandai penempatan `selesai`
  (404 kalau murid memang tidak sedang di kelas itu).
- `GET /api/kelas` — setiap kelas memuat `jumlahMurid` (penempatan aktifnya).

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
`e2e/penempatan.spec.ts` dan dijalankan lebih dulu di database uji.

## Yang masih data tiruan

Halaman `/app/kelas`, `/app/murid`, `/app/murid/<id>`, dan `/app/penempatan`
masih memakai data contoh di layar (lihat `src/lib/mock-penempatan.ts`).
Penyambungan penuh ke API penempatan menyusul; aturan di dokumen ini sudah
berlaku di API, service, dan basis data.
