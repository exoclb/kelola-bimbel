# Backend standard

The Notes API is a small, working reference backend. It saves real PostgreSQL rows and uses the existing Better Auth accounts. It has no seeded users, mock sessions, or fabricated responses. Use the same structure for new features.

```text
HTTP request
  → src/app/api/notes/route.ts or notes/[id]/route.ts
  → withApiSession: Better Auth session and mutation origin check
  → src/validators/notes.ts: validate JSON, parameters, and query strings
  → src/services/notes.service.ts: domain operations and Drizzle queries
  → src/db/schema/notes.ts: PostgreSQL table
```

## Responsibilities

- **Routes** own HTTP: authenticate, parse/validate, call a service, and choose response status. Application routes do not query Drizzle or PostgreSQL directly.
- **Services** own application rules and database queries. They receive the verified session's user ID as a separate argument. Every user-owned read, update, and delete filters by it in SQL. Updates/deletes use one scoped statement, avoiding a separate ownership check that could race. Services never accept a request, return a Response, redirect, or read cookies.
- **Validators** define allowed input and inferred TypeScript types. Strict schemas reject unknown fields, including submitted owner IDs. PATCH requires at least one editable field. Database IDs and query parameters are validated before queries.
- **Schemas** define tables, indexes, defaults, and relationships. Each table has its own file; `src/db/schema/index.ts` exports them all for Drizzle Kit, the pool, and Better Auth. Table files import dependencies directly from sibling files, avoiding circular barrel imports.
- **Shared HTTP helpers** in `src/lib/api.ts` provide session checks, JSON parsing, errors, and private response caching. Better Auth's own `/api/auth/*` handler stays delegated to Better Auth and its Drizzle adapter.

Authenticate every entrypoint before calling a service. `withApiSession` performs an authoritative Better Auth lookup and returns JSON 401 for an absent, expired, or revoked session. A protected layout is not API authorization. If a Server Component needs a service, first call `requireSession()` there; browser operations use API routes. Do not put SQL into a page or introduce a parallel Server Action mutation flow for ordinary app features.

## Notes endpoints

| Method | Path                           | Result                                            |
| ------ | ------------------------------ | ------------------------------------------------- |
| GET    | `/api/notes?limit=20&offset=0` | 200, current user's notes and pagination metadata |
| POST   | `/api/notes`                   | 201, creates a note and returns a Location header |
| GET    | `/api/notes/:id`               | 200, a single owned note                          |
| PATCH  | `/api/notes/:id`               | 200, changes title and/or content                 |
| DELETE | `/api/notes/:id`               | 204, no response body                             |

All endpoints require the Better Auth session cookie. POST/PATCH accept `Content-Type: application/json`. Every mutation, including DELETE, requires an `Origin` header matching `BETTER_AUTH_URL`; browsers send it for same-origin fetches. Command-line clients must set it explicitly. Cross-site mutations are rejected even with a valid cookie. Better Auth's CSRF checks cover its own endpoints; the helper protects these application endpoints separately.

Create input: `{ "title": "My first note", "content": "Optional text" }`. Title is trimmed and must contain 1–160 characters; content is at most 10,000 characters and defaults to an empty string. IDs are UUIDs. List `limit` is 1–100 (default 20); `offset` is 0–1,000,000 (default 0). Results sort newest first, then by ID for stable ordering. Offset pagination is deliberately simple for this example; concurrent writes can shift pages.

Single-item responses wrap a note in `data`. Each note contains `id`, `title`, `content`, `createdAt`, and `updatedAt`; timestamps serialize as ISO strings. Lists return `{ "data": [...], "meta": { "limit", "offset", "hasMore" } }`. Owner IDs and auth records are not part of these responses.

Errors use `{ "error": { "code": "...", "message": "..." } }`, with field `details` for validation errors. Statuses are 400 for malformed JSON, 401 for missing/invalid sessions, 403 for rejected origins, 404 for missing or unowned records, 415 for unsupported content types, 422 for invalid input, and 500 for unexpected failures. Missing and unowned records have identical responses. Database exceptions and private values are not returned. Application API responses use `Cache-Control: private, no-store`.

## App endpoints

App features follow the same structure as Notes: route → `withApiSession` → validator → service → Drizzle table.

Operasi jurnal milik guru ada di `src/services/jurnal.service.ts` (simpan, riwayat, detail, koreksi), pembacaan lintas akun untuk pantauan owner — ringkasan harian, deteksi kelas kosong, daftar jurnal harian, saringan — ada di `src/services/pemantauan.service.ts`, dan perhitungan gaji (jam mengajar × tarif yang berlaku) ada di `src/services/gaji.service.ts`. Fungsi yang menjangkau akun lain memakai akhiran `Any` dan hanya boleh dipanggil dari endpoint yang dijaga izin role.

| Method | Path                           | Result                                                                  |
| ------ | ------------------------------ | ----------------------------------------------------------------------- |
| GET    | `/api/jadwal`                  | 200, jadwal mengajar guru yang sedang masuk pada satu hari              |
| GET    | `/api/jadwal?hari=…`           | 200, jadwal pada hari lain (`Senin`–`Minggu`, huruf awal besar)         |
| GET    | `/api/jurnal`                  | 200, riwayat jurnal guru (saring kelas & rentang tanggal, berhalaman)   |
| GET    | `/api/murid`                   | 200, daftar murid (cari: nama murid, orang tua, atau kontaknya)         |
| POST   | `/api/murid`                   | 201, menambah murid baru                                                |
| GET    | `/api/gaji`                    | 200, rekap & rincian jam ngajar milik guru yang sedang masuk            |
| GET    | `/api/jurnal/:id`              | 200, detail satu jurnal beserta daftar muridnya                         |
| GET    | `/api/admin/jurnal`            | 200, owner melihat jurnal semua guru pada satu tanggal                  |
| GET    | `/api/admin/jurnal/:id`        | 200, owner membuka detail satu jurnal guru siapa pun                    |
| GET    | `/api/admin/ringkasan-guru`    | 200, ringkasan harian: jadwal & status jurnal tiap guru                 |
| GET    | `/api/admin/opsi-saring`       | 200, pilihan saringan pantauan: kelas, guru, dan cabang                 |
| GET    | `/api/admin/status-pemantauan` | 200, angka ringkas pantauan untuk pembaruan berkala                     |
| GET    | `/api/admin/gaji`              | 200, rekap gaji semua guru pada satu bulan (owner)                      |
| PATCH  | `/api/admin/gaji`              | 200, tandai/batalkan pembayaran gaji satu guru pada satu bulan          |
| GET    | `/api/admin/gaji/slip`         | 200, unduh slip gaji satu guru sebagai dokumen HTML                     |
| GET    | `/api/admin/gaji/riwayat`      | 200, riwayat gaji per bulan (saringan tahun & bulan)                    |
| GET    | `/api/notifikasi`              | 200, notifikasi milik akun yang sedang masuk (bisa saring belum dibaca) |
| PATCH  | `/api/notifikasi`              | 200, tandai notifikasi tertentu atau semua sebagai sudah dibaca         |
| POST   | `/api/jurnal`                  | 200, simpan & kirim jurnal mengajar (idempoten per jadwal + tanggal)    |
| PATCH  | `/api/jurnal/:id`              | 200, koreksi isi jurnal (materi, catatan, dan/atau kehadiran)           |
| POST   | `/api/akun`                    | 201, mendaftarkan akun guru baru (langsung masuk)                       |
| POST   | `/api/masuk`                   | 200, masuk dengan email & sandi (membuat sesi)                          |
| GET    | `/api/sesi`                    | 200, akun yang sedang masuk beserta perannya                            |
| DELETE | `/api/sesi`                    | 204, keluar dan mencabut sesi di server                                 |
| POST   | `/api/lupa-sandi`              | 200, meminta tautan atur ulang sandi (jawaban selalu sama)              |
| POST   | `/api/atur-ulang-sandi`        | 200, mengganti sandi memakai token dari tautan                          |

`hari` boleh dikosongkan; tanpa parameter itu server memakai hari ini menurut `src/lib/tanggal.ts`. Nilai di luar daftar hari ditolak dengan 422. Hasilnya `{ "data": [{ id, classId, namaKelas, cabang, jamMulai, jamSelesai }] }` dengan jam dalam bentuk `HH:MM`, diurutkan dari jam paling awal. Saringan `guru_id` selalu memakai id dari sesi, bukan dari permintaan, jadi satu guru tidak pernah melihat jadwal guru lain.

`POST /api/jurnal` menerima `{ "jadwalId", "materi", "catatan", "kehadiran": [{ "muridId", "hadir", "catatan" }] }`. Kelas, tanggal, dan jam mengajar **tidak** dikirim klien: server mengambilnya dari jadwal milik guru yang sedang masuk, sehingga jam yang ikut dihitung gaji tidak bisa dinaikkan dari sisi klien. Kirim ulang untuk jadwal dan tanggal yang sama memperbarui jurnal hari itu alih-alih menambah baris baru (dijaga indeks unik `teaching_journals_guru_jadwal_tanggal_idx`), jadi dobel klik atau kirim ulang setelah koneksi putus tidak pernah terhitung dua kali saat rekap gaji; karena isinya berubah, statusnya kembali ke `terkirim` supaya owner meninjau ulang. Jadwal milik guru lain dijawab 404 yang sama dengan jadwal yang tidak ada, dan murid yang tidak terdaftar dijawab 422 dengan `details` per baris.

`GET /api/jurnal` menerima `limit` (1–100, bawaan 20), `offset` (bawaan 0), `classId` (UUID kelas), `dari`, dan `sampai` (format `YYYY-MM-DD`, keduanya inklusif; `dari` setelah `sampai` ditolak 422). Hasilnya `{ "data": [...], "meta": { "limit", "offset", "hasMore", "kelas": [{ "classId", "namaKelas" }] } }`; `meta.kelas` berisi semua kelas yang pernah diisi guru ini (tanpa ikut tersaring) supaya tampilan bisa menyusun pilihan saringan. Setiap baris memuat `id`, `classId`, `namaKelas`, `cabang`, `hari`, `jamMulai`, `jamSelesai`, `tanggal`, `materi`, `catatan`, `jamMengajar`, `status`, `jumlahMurid`, dan `jumlahHadir`. Baris lama yang jadwalnya sudah dihapus tetap muncul dengan `jamMulai`/`jamSelesai` bernilai `null`.

`GET /api/jurnal/:id` mengembalikan satu jurnal milik guru yang sedang masuk beserta `kehadiran: [{ muridId, nama, hadir, catatan }]` yang diurutkan menurut nama murid. Jurnal milik guru lain dan id yang tidak ada sama-sama dijawab 404. `PATCH /api/jurnal/:id` menerima sebagian saja dari `{ "materi", "catatan", "kehadiran" }` (minimal satu; field lain seperti `jamMengajar`, `classId`, atau `tanggal` ditolak 422) dan mengembalikan bentuk yang sama seperti `GET`. Mengirim `kehadiran` akan mengganti seluruh daftar kehadiran jurnal itu. Kelas, tanggal, dan jam mengajar tidak pernah ikut berubah lewat koreksi, dan status dikembalikan ke `terkirim` supaya owner meninjau ulang.

`GET /api/admin/jurnal` dipakai owner untuk memantau jurnal harian semua guru. Endpoint ini membaca baris milik akun lain, jadi dijaga `withApiPermission(request, { jurnal: ["read-any"] }, …)`: guru biasa (role `user`) menerima 403 walau punya sesi yang sah, sedangkan role `owner` (atau `admin`) boleh membacanya. Parameter yang diterima: `tanggal` (bawaan hari ini), `classId`, `guruId`, `cabang`, `limit` (bawaan 50), dan `offset`; hasilnya `{ "data": [...], "meta": { "tanggal", "limit", "offset", "hasMore" } }` dengan setiap baris memuat `guruNama`, `guruEmail`, kelas, jam, jam mengajar, status, dan jumlah kehadiran, diurutkan menurut nama guru lalu jam mulai. Id akun (`guruId`) berasal dari Better Auth dan divalidasi sebagai string 1–64 karakter, bukan UUID. Guru yang membuka `/api/jurnal` tetap hanya melihat jurnalnya sendiri — izin tambahan hanya melebarkan endpoint lintas akun.

`GET /api/admin/ringkasan-guru` merangkum satu hari untuk owner: setiap guru yang punya jadwal hari itu (ditambah siapa pun yang sudah mengirim jurnal), jadwal apa saja yang harus dia ajar, dan apakah jurnalnya sudah dikirim. Parameternya `tanggal` (bawaan hari ini, format `YYYY-MM-DD`), `classId`, `guruId`, dan `cabang`; saringan kelas/guru/cabang ikut menyaring jadwal maupun jurnalnya. Hasilnya `{ "data": [{ guruId, guruNama, guruEmail, jadwal: [{ namaKelas, jamMulai, jamSelesai }], jumlahJurnal, totalJam, sudahMengisi }], "meta": { tanggal, hari, jumlahGuru, sudahMengisi, belumMengisi } }`, dengan guru yang belum mengisi tampil lebih dulu. Endpoint ini juga dijaga `jurnal: read-any`, jadi guru biasa menerima 403.

`GET /api/admin/jurnal/:id` membuka detail satu jurnal guru siapa pun untuk owner, lengkap dengan nama/email gurunya dan `kehadiran: [{ muridId, nama, hadir, catatan }]`. Bentuk isinya sama dengan `GET /api/jurnal/:id`, hanya saja tidak dibatasi pemilik, jadi endpoint ini juga dijaga `jurnal: read-any` (guru biasa menerima 403) dan id yang tidak ada dijawab 404.

`GET /api/notifikasi` mengembalikan notifikasi milik akun yang sedang masuk, terbaru lebih dulu, dengan `limit` (1–100, bawaan 20), `offset`, dan `belumDibaca=true` untuk menyaring yang belum dibaca. Hasilnya `{ "data": [{ id, tipe, pesan, sudahDibaca, createdAt }], "meta": { limit, offset, hasMore, belumDibaca } }`; `meta.belumDibaca` selalu dihitung dari seluruh notifikasi akun itu, bukan dari halaman yang sedang tampil. `PATCH /api/notifikasi` menerima `{ "ids": [...] }` (maksimal 100 id) atau `{ "semua": true }` dan mengembalikan `{ "jumlah": n }` — jumlah baris yang benar-benar berubah, jadi menandai ulang yang sudah dibaca menghasilkan 0. Penyaring pemilik ada di perintah UPDATE-nya, jadi id milik akun lain tidak pernah tersentuh.

`GET /api/admin/opsi-saring` mengembalikan pilihan yang dipakai tampilan pantauan: `{ "data": { "kelas": [{ classId, namaKelas, cabang }], "guru": [{ guruId, guruNama }], "cabang": ["..."] } }`. Kelas dan cabang berasal dari tabel `classes`, sedangkan `guru` adalah akun yang perannya memuat `user` (akun owner/admin tidak ikut). Dijaga `jurnal: read-any`, jadi hanya owner yang bisa membacanya.

`GET /api/admin/status-pemantauan` mengembalikan angka ringkas untuk pembaruan berkala halaman owner — cukup kecil untuk dipanggil berulang: `{ "data": { "tanggal", "hari", "jumlahGuru", "sudahMengisi", "belumMengisi", "jumlahJurnal", "totalJam", "kelasKosong", "terakhirDiperbarui" } }`. Parameternya sama seperti `/api/admin/ringkasan-guru` (`tanggal`, `classId`, `guruId`, `cabang`), angkanya dihitung dari layanan pantauan yang sama sehingga selalu cocok dengan halaman, dan jawabannya `private, no-store` supaya klien selalu mengambil kondisi terbaru.

`GET /api/admin/gaji` menghitung gaji semua guru pada satu bulan: jam mengajar diambil dari jurnal bulan itu, dikalikan tarif yang berlaku (baris `salary_settings` terbaru yang `berlaku_sejak`-nya tidak melewati akhir bulan tersebut). Parameter `periode` berbentuk `YYYY-MM` dan boleh dikosongkan (bawaan: bulan berjalan); bentuk lain ditolak 422. Hasilnya `{ "data": { "periode", "tarifPerJam", "tarifDiatur", "daftar": [{ guruId, guruNama, guruEmail, jumlahJurnal, totalJam, tarifPerJam, totalGaji, statusPembayaran, tanggalDibayar, rincian: [{ tanggal, namaKelas, jamMengajar, jumlahHadir, jumlahMurid }] }] } }`. Kalau tarif belum pernah diatur, `tarifDiatur` bernilai `false` dan semua total bernilai 0 — tampilan bisa mengingatkan owner untuk mengisi tarif dulu. Status pembayaran diambil dari tabel `salary_recaps` (tanpa catatan berarti `belum_dibayar`). Endpoint ini dijaga `gaji: read-any`, jadi guru biasa menerima 403.

`PATCH /api/admin/gaji` menandai pembayaran: `{ "guruId", "periode": "YYYY-MM", "dibayar": true|false }`. Saat ditandai dibayar, jumlah jam, tarif, dan total gaji disalin ke `salary_recaps` sebagai bukti — kalau tarif atau jurnal berubah setelahnya, catatan pembayaran tetap seperti saat itu, sementara angka di rekap selalu dihitung ulang dari data terbaru. Satu guru hanya punya satu catatan per bulan, jadi mengirim ulang memperbarui baris yang sama (tidak menumpuk), dan `dibayar: false` mengembalikan statusnya menjadi `belum_dibayar` sekaligus menghapus tanggal pembayarannya. Id guru yang tidak dikenal dijawab 404, dan endpoint ini juga wajib lewat izin `gaji: read-any`.

`GET /api/gaji` adalah pasangan milik sendiri dari `/api/admin/gaji`: guru yang sedang masuk menerima rekap dan rincian jam ngajarnya pada satu bulan (`periode` `YYYY-MM`, bawaan bulan berjalan). Hasilnya `{ "data": { "periode", "tarifPerJam", "tarifDiatur", "guru": { guruId, guruNama, guruEmail, jumlahJurnal, totalJam, tarifPerJam, totalGaji, statusPembayaran, tanggalDibayar, rincian: [...] } } }`. Id guru selalu diambil dari sesi — parameter `guruId` tidak diterima (ditolak 422), jadi guru tidak bisa membaca gaji orang lain lewat endpoint ini.

`GET /api/admin/gaji/slip?guruId=…&periode=YYYY-MM` mengunduh slip gaji satu guru sebagai dokumen HTML mandiri (`Content-Disposition: attachment`, nama berkas `slip-gaji-<nama-guru>-<periode>.html`). Isinya sama dengan yang tampil di halaman slip: identitas bimbel, identitas guru, tabel rincian jam per pertemuan, total jam × tarif, dan status pembayaran beserta tanggalnya. Gayanya ditulis di dalam dokumen dan tidak ada berkas luar, jadi berkasnya bisa langsung dicetak atau dikirim ke guru tanpa aplikasi. Dijaga `gaji: read-any`; id guru yang tidak dikenal dijawab 404.

`GET /api/admin/gaji/riwayat?tahun=YYYY&bulan=MM` merangkum gaji tiap bulan yang punya jurnal: `{ "data": { "daftar": [{ periode, jumlahGuru, totalJam, totalGaji, jumlahDibayar }], "tahunTersedia": [YYYY] } }`, terbaru lebih dulu. `tahun` wajib (2000–2100) dan `bulan` opsional (`01`–`12`). Totalnya dihitung dengan tarif yang berlaku **saat bulan itu**, bukan tarif terkini, jadi menaikkan tarif tidak mengubah angka bulan-bulan lama; `jumlahDibayar` diambil dari catatan di `salary_recaps`. `tahunTersedia` dipakai tampilan untuk menyusun pilihan tahun.

`GET /api/murid` mengembalikan daftar murid bimbel, terurut nama, dengan `limit` (1–100, bawaan 50), `offset`, dan `cari` (kata kunci yang dicocokkan ke nama murid, nama orang tua, **dan** kontak orang tua; tanda `%` dan `_` diperlakukan sebagai huruf biasa). Hasilnya `{ "data": [{ id, nama, tanggalLahir, namaOrangTua, kontakOrangTua, statusAktif, createdAt }], "meta": { limit, offset, hasMore, total } }`. `POST /api/murid` menerima `{ "nama", "tanggalLahir": "YYYY-MM-DD", "namaOrangTua"?, "kontakOrangTua"?, "statusAktif"? }` — nama 1–120 karakter, tanggal lahir wajib dan harus tanggal yang benar-benar ada (masa depan boleh, tetapi tampilan yang membatasinya), kolom lain boleh kosong — lalu menjawab 201 dengan `Location: /api/murid/:id`. Data murid dipakai bersama seluruh akun bimbel, jadi guru maupun owner sama-sama boleh membacanya dan menambahkannya; cukup sesi yang sah (tanpa izin tambahan).

`GET /api/kelas` mengembalikan daftar kelas terurut nama dengan `limit` (1–100, bawaan 50), `offset`, dan `cari` (nama kelas, cabang, atau nama guru pengampu). Setiap baris memuat `{ id, namaKelas, cabang, guruId, guruNama, createdAt, jadwal: [{ id, hari, jamMulai, jamSelesai }] }` — jam dalam bentuk `HH:MM` dan jadwalnya terurut hari lalu jam mulai, sedangkan `meta.total` adalah jumlah seluruh kelas yang cocok (bukan hanya halaman ini).

`POST /api/kelas` menerima `{ namaKelas, cabang, guruId?, jadwal? }`. Kelas dan jadwalnya disimpan dalam satu transaksi, jadi tidak ada kelas yang setengah jadi. Satu jadwal wajib punya guru (kolom `schedules.guru_id` tidak boleh kosong), sehingga kalau `jadwal` diisi maka `guruId` juga wajib — kalau tidak, jawabannya 422 `Pilih guru pengampu dulu sebelum menyimpan jadwal.`. Jam memakai format `HH:MM` dan jam selesai harus setelah jam mulai; jadwal dengan hari & jam mulai yang sama di dalam satu permintaan maupun di database ditolak (yang terakhir dijawab 409 `JADWAL_SUDAH_ADA`). `POST /api/kelas/:id/jadwal` menambah satu jadwal ke kelas yang sudah ada dan mengembalikan kelasnya yang sudah diperbarui, sedangkan `DELETE /api/kelas/:id/jadwal/:jadwalId` menghapusnya (404 kalau bukan milik kelas itu). Kelas tidak boleh punya dua jadwal dengan hari & jam mulai yang sama supaya jam mengajar tidak terhitung dua kali di rekap gaji; kelas, jadwal, dan penempatan murid boleh diatur oleh guru maupun owner (cukup sesi yang sah).

`GET /api/kelas/:id/murid` mengembalikan murid yang **sedang** di kelas itu (penempatan berstatus `aktif`), terurut nama, lengkap dengan `tanggalMulai`. Setiap kelas pada `GET /api/kelas` juga memuat `jumlahMurid` berisi jumlah penempatan aktifnya.

`POST /api/kelas/:id/murid` menerima `{ muridId, tanggalMulai? }` (tanggal mulai kosong berarti hari ini) dan menjawab 201 dengan daftar murid terbaru kelas itu. Satu murid hanya boleh punya satu penempatan aktif — dijaga indeks unik parsial `student_enrollments_student_aktif_idx` — sehingga murid yang sudah punya kelas lain dijawab 409 `SUDAH_TERDAFTAR`; pindah kelas caranya keluarkan dulu dari kelas lama. `DELETE /api/kelas/:id/murid/:muridId` mengeluarkan murid dengan menandai penempatannya `selesai` (riwayat tetap tersimpan, bukan dihapus) dan menjawab 404 kalau murid itu memang tidak sedang di kelas tersebut.

`GET /api/perkembangan` mengembalikan catatan perkembangan semua anak, terbaru lebih dulu (urut tanggal lalu waktu dibuat), dengan `limit` (1–100, bawaan 50), `offset`, serta penyaring `muridId`, `dari`/`sampai` (`YYYY-MM-DD`), dan `cari` (nama anak atau isi catatannya). Rentang tanggal yang terbalik dijawab 422. Setiap baris memuat `{ id, muridId, muridNama, guruId, guruNama, tanggal, nilai, sikap, catatanPerkembangan, createdAt, updatedAt }` dan `meta.total` adalah jumlah seluruh catatan yang cocok.

`POST /api/perkembangan` menerima `{ muridId, tanggal, nilai, sikap, catatanPerkembangan? }` — nilai 0–100 dan wajib berupa angka, tanggal wajib tanggal yang benar-benar ada, dan murid harus ada (kalau tidak: 404). **Guru penulisnya diambil dari sesi**, jadi mengirim `guruId` sendiri dijawab 422 dan catatan tidak bisa diatasnamakan akun lain. `GET /api/perkembangan/:id` menampilkan satu catatan; `PATCH` hanya menerima `tanggal`, `nilai`, `sikap`, dan `catatanPerkembangan` (murid tidak bisa dipindah) dan wajib mengirim minimal satu kolom. `PATCH` dan `DELETE` terbatas untuk **penulis catatannya**: catatan guru lain dijawab 404 yang sama dengan catatan yang tidak ada, sehingga tidak bisa ditimpa atau dihapus akun lain. Perubahan catatan tidak menyentuh baris lain; kolom yang tidak dikirim dibiarkan seperti semula.

`GET /api/kehadiran` mengembalikan kehadiran murid dari jurnal yang sudah diisi guru, terbaru lebih dulu lalu urut nama anak, dengan `limit` (1–100, bawaan 50), `offset`, serta penyaring `muridId`, `kelasId`, `dari`/`sampai` (`YYYY-MM-DD`). Setiap baris memuat `{ jurnalId, muridId, muridNama, kelasId, kelasNama, guruNama, tanggal, hadir, catatan }` — tanggalnya ikut jurnal harinya karena kehadiran tidak menyimpan tanggal sendiri. `meta` memuat `total`, `hadir`, dan `tidakHadir` yang dihitung dari **seluruh** baris yang cocok penyaring, bukan hanya halaman yang dikirim, sehingga laporan bisa menulis "12 dari 14 pertemuan" tanpa mengambil semua halaman. Kehadiran ditulis lewat `POST /api/jurnal` (bagian `kehadiran`); permintaan ke sini hanya membaca. Sikap anak dibaca dari `/api/perkembangan?muridId=…`, jadi satu halaman laporan cukup memanggil kedua endpoint itu.

`GET /api/perkembangan/ringkasan` adalah laporan agregat: **satu baris per anak** yang sudah punya catatan atau kehadiran, berisi `{ muridId, muridNama, jumlahCatatan, rataNilai, nilaiTerakhir, sikapTerakhir, tanggalCatatanTerakhir, jumlahPertemuan, jumlahHadir }`. Nilai terakhir dan sikap terakhir diambil dari catatan terbaru anak itu (tanggal terbaru, lalu waktu dibuat), sedangkan `rataNilai` dirata-ratakan dari semua catatan yang cocok penyaring (satu angka di belakang koma). Penyaringnya sama seperti daftar catatan (`muridId`, `dari`/`sampai`, `cari` nama anak, `limit`, `offset`) dan penyaring tanggal berlaku untuk catatan **dan** kehadiran sekaligus, sehingga laporan satu periode berisi angka periode itu saja. `meta` memuat `total` (jumlah anak di laporan), `muridPunyaCatatan`, dan `totalCatatan`; angka-angka itu dihitung dari seluruh baris yang cocok, bukan hanya halaman yang dikirim. Anak yang belum punya catatan tetap muncul dengan `jumlahCatatan: 0` selama ada kehadirannya, jadi laporan ke orang tua tidak terlihat kosong.

`GET /api/perkembangan/riwayat` mengemas semuanya untuk **satu** anak dalam sekali panggil: `{ murid, ringkasan, catatan, kehadiran }`. `muridId` wajib (kalau tidak: 422; kalau anaknya tidak ada: 404), `limit` (1–100, bawaan 50) dan `offset` berlaku untuk daftar `catatan` maupun `kehadiran`, dan `ringkasan` memakai bentuk yang sama dengan laporan agregat. Halaman riwayat dan laporan orang tua memakai endpoint ini supaya angka catatan dan kehadiran yang dilihat keduanya pasti sama.

Seluruh endpoint perkembangan (`/api/perkembangan`, `/api/perkembangan/:id`, `/api/perkembangan/ringkasan`, `/api/perkembangan/riwayat`) dan `/api/kehadiran` dijaga izin `perkembangan`: **hanya guru (role `user`), owner, dan admin** yang boleh membuka. Akun yang tidak punya izin itu dijawab 403 `FORBIDDEN` — berbeda dari jurnal yang cuma boleh dibaca pemiliknya, data perkembangan memang dipakai bersama guru pengampu. Tanpa sesi tetap 401, dan menulis (POST/PATCH/DELETE) butuh izin `write` sedangkan membaca butuh `read`.

`POST /api/akun` mendaftarkan akun baru: menerima `{ nama, email, sandi }` (nama 2–120 huruf, sandi 8–128 huruf) dan menjawab 201 dengan `{ id, nama, email, peran }`. **Peran tidak bisa dipilih pendaftar** — permintaan yang menyertakan `peran` dijawab 422, dan akun barunya selalu berperan guru (bawaan kolom `user.role`); peran owner diberikan lewat pengaturan, bukan lewat pendaftaran. Email yang sudah dipakai dijawab 409 `EMAIL_SUDAH_DIPAKAI`, dan sesi yang dibuat pendaftaran ini ikut dikirim sebagai cookie sehingga pendaftar langsung masuk — sama seperti endpoint bawaan Better Auth.

Endpoint ini terbuka (belum punya sesi) tetapi tidak melewati jalur auth begitu saja: origin tetap diperiksa (`assertSameOrigin`, 403 untuk origin lain) dan pembuatan akunnya diserahkan ke Better Auth lewat `auth.handler`, jadi **batas laju bawaan Better Auth tetap berlaku** (pendaftaran beruntun dijawab 429, bukan dibiarkan lewat). Alamat internal yang dipakai `auth.handler` diambil dari `BETTER_AUTH_URL`, bukan dari alamat permintaan, supaya tetap benar saat aplikasi diakses lewat proksi atau port lain.

`POST /api/masuk` menerima `{ email, sandi }` dan menjawab 200 dengan `{ id, nama, email, peran, tujuan }` — `tujuan` adalah halaman utama perannya (`/app/jurnal` untuk guru, `/app/pemantauan` untuk owner), jadi pemanggil tidak perlu menyalin aturan pengalihannya. Email yang tidak terdaftar dan sandi yang salah dijawab **sama**: 401 `EMAIL_ATAU_SANDI_SALAH`, supaya halaman masuk tidak bisa dipakai menebak email mana yang punya akun. Akun yang dinonaktifkan (kolom `banned`) dijawab 403 `AKUN_NONAKTIF`. Sesi yang dibuatnya dikirim sebagai cookie, sama seperti endpoint bawaan Better Auth — termasuk batas lajunya.

`GET /api/sesi` mengembalikan `{ id, nama, email, peran, tujuan, kedaluwarsa }` untuk cookie yang sedang dipakai, dan 401 kalau tidak ada sesi. `DELETE /api/sesi` **mencabut sesinya di server** (baris `session` dihapus, bukan cuma cookie-nya dikosongkan) lalu menjawab 204 dengan cookie sesi yang dibersihkan, sehingga cookie lama tidak bisa dipakai ulang. Akun yang **dinonaktifkan** (kolom `user.banned`) juga berlaku seketika: `getSession` dan `withApiSession` menganggapnya tidak punya sesi, jadi cookie yang masih tersimpan langsung dijawab 401 di API dan dialihkan ke halaman masuk di halaman web — tidak perlu menunggu cookie-nya kedaluwarsa.

## Lupa sandi

`POST /api/lupa-sandi` menerima `{ email }` dan selalu menjawab 200 `{ terkirim: true }` — baik emailnya terdaftar maupun tidak — supaya halaman lupa sandi tidak bisa dipakai menebak email mana yang punya akun. Yang membuat dan mengirim tautannya tetap Better Auth (lewat `sendResetPassword` di `src/lib/auth.ts`); kalau fitur itu dimatikan di servernya, jawabannya 503 `FITUR_BELUM_AKTIF` alih-alih mengaku sudah mengirim. Tautannya berlaku satu jam dan hanya bisa dipakai sekali. `POST /api/atur-ulang-sandi` menerima `{ token, sandi }` (sandi 8–128 huruf) dan menukar token dari tautan dengan sandi baru. Token yang salah, sudah dipakai, atau kedaluwarsa dijawab 422 dengan `token` sebagai kolomnya; percobaan yang gagal tidak menghabiskan token aslinya. Sandi baru berarti **semua sesi akun itu dicabut** (`revokeSessionsOnPasswordReset`), jadi cookie yang masih tersimpan langsung tidak berlaku — penting kalau sandinya diganti justru karena akunnya sempat dipakai orang lain. Halaman `/lupa-password` memakai `/api/lupa-sandi` untuk minta tautan, dan `/atur-ulang-password?token=…` memakai endpoint ini untuk menukarnya.

## Data model

Selain tabel bawaan starter (`user`, `session`, `account`, `verification`, `notes`), aplikasi ini memakai tabel berikut — semuanya di `src/db/schema/` dan dibuat lewat migrasi Drizzle:

| Tabel                                       | Isinya                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `students`                                  | Data murid bimbel (nama, tanggal lahir, orang tua, status aktif).                                                                          |
| `classes`                                   | Kelas bimbel beserta cabang dan guru pengampunya.                                                                                          |
| `schedules`                                 | Jadwal mengajar per kelas (hari, jam mulai, jam selesai). Satu kelas tidak boleh punya dua jadwal dengan hari & jam mulai yang sama.       |
| `student_enrollments`                       | Penempatan murid ke kelas. Satu murid hanya boleh punya satu penempatan `aktif`; yang lama ditandai `selesai` supaya riwayatnya tetap ada. |
| `teaching_journals`                         | Jurnal mengajar guru; sumber jam mengajar yang dihitung ke gaji. Satu guru satu jurnal per jadwal per tanggal.                             |
| `journal_attendances`                       | Kehadiran tiap murid di dalam satu jurnal.                                                                                                 |
| `student_progress`                          | Catatan perkembangan anak (nilai, sikap, catatan naratif) dari guru.                                                                       |
| `salary_settings`                           | Riwayat tarif per jam; tarif yang dipakai adalah yang berlaku pada bulan yang dihitung.                                                    |
| `salary_recaps`                             | Catatan pembayaran gaji yang sudah ditandai owner.                                                                                         |
| `notifications`, `notification_preferences` | Pemberitahuan dalam aplikasi dan preferensi penerimaannya.                                                                                 |

Aturan yang dijaga database, bukan cuma di kode: indeks unik parsial `student_enrollments_student_aktif_idx` (satu kelas aktif per murid), indeks unik `teaching_journals_guru_jadwal_tanggal_idx` (jurnal tidak dobel sehingga gaji tidak terhitung dua kali), dan indeks unik `schedules_class_hari_jam_idx` (jadwal kelas tidak dobel). Penghapusan murid/kelas ikut menghapus baris turunannya (`on delete cascade`), sedangkan data yang tidak boleh hilang memakai `restrict`.
Tabel akun memakai milik Better Auth (`user`, `account`, `session`, `verification`) dan tidak diganti: id-nya string acak dari Better Auth (bukan UUID), sandi tersimpan di `account.password`, dan peran di `user.role`. Kolom itu kini **wajib diisi** dengan bawaan `user` — nilai itu yang di aplikasi ini berarti **guru**; peran `owner` dan `admin` menyusul di `src/lib/permissions.ts` (`peranDariRole` di `src/lib/peran.ts` memetakan keduanya ke "owner" untuk tampilan). Kolomnya sengaja `text`, bukan enum, karena Better Auth merangkai beberapa peran sekaligus ("admin,support") di kolom yang sama. Status aktif akun memakai kolom `banned` bawaan plugin admin — akun yang di-ban tidak bisa masuk, jadi tidak ada kolom "status_aktif" terpisah yang harus dijaga tetap sinkron.

## Proteksi halaman

Aturan akses halaman app disimpan di dua tempat saja, mengikuti aturan starter (izin tidak diperiksa lewat middleware yang hanya melihat cookie):

| Halaman                                                                                    | Syaratnya                                                                    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `/app`, `/app/jurnal`, `/app/jurnal/riwayat`, `/app/murid`, `/app/kelas`, `/app/gaji/saya` | cukup punya sesi (`requireSession`)                                          |
| `/app/perkembangan`, `/app/perkembangan/riwayat`, `/app/perkembangan/[muridId]`            | izin `perkembangan: read`, diperiksa sekali di `app/perkembangan/layout.tsx` |
| `/app/pemantauan`                                                                          | izin `jurnal: read-any`                                                      |
| `/app/gaji`, `/app/gaji/riwayat`, `/app/gaji/slip/[guruId]`                                | izin `gaji: read-any`                                                        |
| `/admin`                                                                                   | izin `notes: read-any`                                                       |

Pengunjung tanpa sesi dialihkan ke halaman masuk. Akun yang sudah masuk tetapi tidak punya izinnya **dilihat sebagai halaman tidak ada** (404), bukan "terlarang", supaya rute yang tidak boleh dibuka tidak bisa dipetakan satu per satu. Penjagaan seksi yang dipakai bersama (`perkembangan`) diletakkan di layout, jadi halaman baru di dalam seksi itu tidak mungkin lupa menjaganya, sedangkan seksi dengan akses campuran (`gaji` vs `gaji/saya`) menjaga tiap halaman. Middleware Next.js sengaja tidak dipakai: di sana tidak ada akses basis data, jadi yang bisa diperiksa hanya keberadaan cookie — bukan sesi yang sah. Batas keamanan sebenarnya tetap di API, karena halaman hanyalah tampilan.

## Role-based access

Ownership answers "is this row mine?". Roles answer "may this account reach past its own rows?". The starter ships a worked example of the second question using the Better Auth admin plugin.

```text
src/lib/permissions.ts   statement (resources → actions) and roles built from it
src/lib/auth.ts          admin({ ac, roles, defaultRole, adminRoles })
src/lib/auth-client.ts   adminClient({ ac, roles }) for UI-only checks
src/lib/session.ts       requirePermission / hasPermission for pages
src/lib/api.ts           withApiPermission for API routes
```

A statement lists every resource and the actions it allows. A role is a subset. Name actions for the extra reach they grant, because owners already reach their own rows through the session:

```ts
export const statement = {
  ...defaultStatements, // Better Auth's own user and session management
  notes: ["read-any", "delete-any"],
  jurnal: ["read-any"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  user: ac.newRole({ notes: [] }), // guru: hanya jurnalnya sendiri
  owner: ac.newRole({ jurnal: ["read-any"] }), // pemilik bimbel
  admin: ac.newRole({
    ...adminAc.statements,
    notes: ["read-any", "delete-any"],
    jurnal: ["read-any"],
  }),
};
```

Roles live in `user.role` as a string; a comma-separated list such as `admin,support` grants the union. Signup cannot set it — the column is `input: false` — so an account can never promote itself. Every new account gets `defaultRole`.

Grant a role to an existing account:

```sh
npm run role:set -- someone@example.com admin
```

Guard the server, in both places:

```ts
// API route: 401 without a session, 403 without the permission.
export function GET(request: Request) {
  return withApiPermission(request, { notes: ["read-any"] }, async () =>
    Response.json(await listAnyNotes({ limit: 20, offset: 0 })),
  );
}

// Page or Server Action: renders not-found, so the route stays invisible.
const { user } = await requirePermission({ notes: ["read-any"] });
```

Both helpers read the stored role, so revoking a role takes effect on the next request rather than when the session expires. Hiding a link with `hasPermission` or the client's `authClient.admin.checkRolePermission` is presentation only; it never replaces the server check.

| Method | Path                   | Result                                                   |
| ------ | ---------------------- | -------------------------------------------------------- |
| GET    | `/api/admin/notes`     | 200, every account's notes plus `ownerName`/`ownerEmail` |
| DELETE | `/api/admin/notes/:id` | 204, deletes any account's note                          |

Cross-account service functions carry an `Any` suffix (`listAnyNotes`, `deleteAnyNote`) because they deliberately skip the ownership filter. They are only safe behind a permission check — never call them from a handler that merely has a session. Ordinary `listNotes`/`deleteNote` stay scoped to the session user even for an admin, so `/admin` and `/app` show different things to the same person.

The admin plugin also adds `banned`, `banReason`, `banExpires`, and `session.impersonatedBy`, plus its own `/api/auth/admin/*` endpoints for user management. Those are guarded by the `user` and `session` actions in `defaultStatements`, which only `admin` holds here.

## Try it

Start the app and create an account or sign in. In that app tab's browser console:

```js
const response = await fetch("/api/notes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "My first note",
    content: "It is saved in PostgreSQL.",
  }),
});
const result = await response.json();
console.log(result);

await fetch("/api/notes").then((response) => response.json());
```

The browser sends your existing session cookie and origin. Visiting `/api/notes` while signed out returns 401. The example has no Notes UI; it establishes the backend pattern for your app.

## Extend it

1. Create a table file under `src/db/schema/` and export it from `index.ts`. Leave existing auth table names and fields unchanged.
2. Define strict input schemas under `src/validators/`.
3. Add a server-only `*.service.ts` under `src/services/` with all domain queries. Require the authenticated user ID for user-owned operations.
4. Add thin API route handlers using `withApiSession`, or `withApiPermission` when the endpoint reaches past the caller's own rows, then call them from the frontend.
5. Generate a new migration with `npm run db:generate`, inspect it, and apply with `npm run db:migrate`. Keep SQL and metadata together; do not edit applied migrations.
6. Run `npm run check`, `npm run build`, and `npm run test:e2e`. Add tests for CRUD, rejected input, anonymous access, and cross-account isolation like `e2e/notes.spec.ts`. Tests use their own disposable PostgreSQL server.

Notes is replaceable example functionality. If removing it from a project that has already migrated, remove its routes/service/validator/schema export and generate a new reviewed migration. Do not delete or rewrite historical migrations, or drop saved notes without authorization.
