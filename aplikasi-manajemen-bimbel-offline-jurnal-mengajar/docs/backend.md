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

Operasi jurnal milik guru ada di `src/services/jurnal.service.ts` (simpan, riwayat, detail, koreksi), sedangkan pembacaan lintas akun untuk pantauan owner — ringkasan harian, deteksi kelas kosong, daftar jurnal harian, saringan — ada di `src/services/pemantauan.service.ts`. Fungsi yang menjangkau akun lain memakai akhiran `Any` dan hanya boleh dipanggil dari endpoint yang dijaga izin role.

| Method | Path                        | Result                                                                  |
| ------ | --------------------------- | ----------------------------------------------------------------------- |
| GET    | `/api/jadwal`               | 200, jadwal mengajar guru yang sedang masuk pada satu hari              |
| GET    | `/api/jadwal?hari=…`        | 200, jadwal pada hari lain (`Senin`–`Minggu`, huruf awal besar)         |
| GET    | `/api/jurnal`               | 200, riwayat jurnal guru (saring kelas & rentang tanggal, berhalaman)   |
| GET    | `/api/jurnal/:id`           | 200, detail satu jurnal beserta daftar muridnya                         |
| GET    | `/api/admin/jurnal`         | 200, owner melihat jurnal semua guru pada satu tanggal                  |
| GET    | `/api/admin/jurnal/:id`     | 200, owner membuka detail satu jurnal guru siapa pun                    |
| GET    | `/api/admin/ringkasan-guru` | 200, ringkasan harian: jadwal & status jurnal tiap guru                 |
| GET    | `/api/admin/opsi-saring`    | 200, pilihan saringan pantauan: kelas, guru, dan cabang                 |
| GET    | `/api/notifikasi`           | 200, notifikasi milik akun yang sedang masuk (bisa saring belum dibaca) |
| PATCH  | `/api/notifikasi`           | 200, tandai notifikasi tertentu atau semua sebagai sudah dibaca         |
| POST   | `/api/jurnal`               | 200, simpan & kirim jurnal mengajar (idempoten per jadwal + tanggal)    |
| PATCH  | `/api/jurnal/:id`           | 200, koreksi isi jurnal (materi, catatan, dan/atau kehadiran)           |

`hari` boleh dikosongkan; tanpa parameter itu server memakai hari ini menurut `src/lib/tanggal.ts`. Nilai di luar daftar hari ditolak dengan 422. Hasilnya `{ "data": [{ id, classId, namaKelas, cabang, jamMulai, jamSelesai }] }` dengan jam dalam bentuk `HH:MM`, diurutkan dari jam paling awal. Saringan `guru_id` selalu memakai id dari sesi, bukan dari permintaan, jadi satu guru tidak pernah melihat jadwal guru lain.

`POST /api/jurnal` menerima `{ "jadwalId", "materi", "catatan", "kehadiran": [{ "muridId", "hadir", "catatan" }] }`. Kelas, tanggal, dan jam mengajar **tidak** dikirim klien: server mengambilnya dari jadwal milik guru yang sedang masuk, sehingga jam yang ikut dihitung gaji tidak bisa dinaikkan dari sisi klien. Kirim ulang untuk jadwal dan tanggal yang sama memperbarui jurnal hari itu alih-alih menambah baris baru (dijaga indeks unik `teaching_journals_guru_jadwal_tanggal_idx`), jadi dobel klik atau kirim ulang setelah koneksi putus tidak pernah terhitung dua kali saat rekap gaji; karena isinya berubah, statusnya kembali ke `terkirim` supaya owner meninjau ulang. Jadwal milik guru lain dijawab 404 yang sama dengan jadwal yang tidak ada, dan murid yang tidak terdaftar dijawab 422 dengan `details` per baris.

`GET /api/jurnal` menerima `limit` (1–100, bawaan 20), `offset` (bawaan 0), `classId` (UUID kelas), `dari`, dan `sampai` (format `YYYY-MM-DD`, keduanya inklusif; `dari` setelah `sampai` ditolak 422). Hasilnya `{ "data": [...], "meta": { "limit", "offset", "hasMore", "kelas": [{ "classId", "namaKelas" }] } }`; `meta.kelas` berisi semua kelas yang pernah diisi guru ini (tanpa ikut tersaring) supaya tampilan bisa menyusun pilihan saringan. Setiap baris memuat `id`, `classId`, `namaKelas`, `cabang`, `hari`, `jamMulai`, `jamSelesai`, `tanggal`, `materi`, `catatan`, `jamMengajar`, `status`, `jumlahMurid`, dan `jumlahHadir`. Baris lama yang jadwalnya sudah dihapus tetap muncul dengan `jamMulai`/`jamSelesai` bernilai `null`.

`GET /api/jurnal/:id` mengembalikan satu jurnal milik guru yang sedang masuk beserta `kehadiran: [{ muridId, nama, hadir, catatan }]` yang diurutkan menurut nama murid. Jurnal milik guru lain dan id yang tidak ada sama-sama dijawab 404. `PATCH /api/jurnal/:id` menerima sebagian saja dari `{ "materi", "catatan", "kehadiran" }` (minimal satu; field lain seperti `jamMengajar`, `classId`, atau `tanggal` ditolak 422) dan mengembalikan bentuk yang sama seperti `GET`. Mengirim `kehadiran` akan mengganti seluruh daftar kehadiran jurnal itu. Kelas, tanggal, dan jam mengajar tidak pernah ikut berubah lewat koreksi, dan status dikembalikan ke `terkirim` supaya owner meninjau ulang.

`GET /api/admin/jurnal` dipakai owner untuk memantau jurnal harian semua guru. Endpoint ini membaca baris milik akun lain, jadi dijaga `withApiPermission(request, { jurnal: ["read-any"] }, …)`: guru biasa (role `user`) menerima 403 walau punya sesi yang sah, sedangkan role `owner` (atau `admin`) boleh membacanya. Parameter yang diterima: `tanggal` (bawaan hari ini), `classId`, `guruId`, `cabang`, `limit` (bawaan 50), dan `offset`; hasilnya `{ "data": [...], "meta": { "tanggal", "limit", "offset", "hasMore" } }` dengan setiap baris memuat `guruNama`, `guruEmail`, kelas, jam, jam mengajar, status, dan jumlah kehadiran, diurutkan menurut nama guru lalu jam mulai. Id akun (`guruId`) berasal dari Better Auth dan divalidasi sebagai string 1–64 karakter, bukan UUID. Guru yang membuka `/api/jurnal` tetap hanya melihat jurnalnya sendiri — izin tambahan hanya melebarkan endpoint lintas akun.

`GET /api/admin/ringkasan-guru` merangkum satu hari untuk owner: setiap guru yang punya jadwal hari itu (ditambah siapa pun yang sudah mengirim jurnal), jadwal apa saja yang harus dia ajar, dan apakah jurnalnya sudah dikirim. Parameternya `tanggal` (bawaan hari ini, format `YYYY-MM-DD`), `classId`, `guruId`, dan `cabang`; saringan kelas/guru/cabang ikut menyaring jadwal maupun jurnalnya. Hasilnya `{ "data": [{ guruId, guruNama, guruEmail, jadwal: [{ namaKelas, jamMulai, jamSelesai }], jumlahJurnal, totalJam, sudahMengisi }], "meta": { tanggal, hari, jumlahGuru, sudahMengisi, belumMengisi } }`, dengan guru yang belum mengisi tampil lebih dulu. Endpoint ini juga dijaga `jurnal: read-any`, jadi guru biasa menerima 403.

`GET /api/admin/jurnal/:id` membuka detail satu jurnal guru siapa pun untuk owner, lengkap dengan nama/email gurunya dan `kehadiran: [{ muridId, nama, hadir, catatan }]`. Bentuk isinya sama dengan `GET /api/jurnal/:id`, hanya saja tidak dibatasi pemilik, jadi endpoint ini juga dijaga `jurnal: read-any` (guru biasa menerima 403) dan id yang tidak ada dijawab 404.

`GET /api/notifikasi` mengembalikan notifikasi milik akun yang sedang masuk, terbaru lebih dulu, dengan `limit` (1–100, bawaan 20), `offset`, dan `belumDibaca=true` untuk menyaring yang belum dibaca. Hasilnya `{ "data": [{ id, tipe, pesan, sudahDibaca, createdAt }], "meta": { limit, offset, hasMore, belumDibaca } }`; `meta.belumDibaca` selalu dihitung dari seluruh notifikasi akun itu, bukan dari halaman yang sedang tampil. `PATCH /api/notifikasi` menerima `{ "ids": [...] }` (maksimal 100 id) atau `{ "semua": true }` dan mengembalikan `{ "jumlah": n }` — jumlah baris yang benar-benar berubah, jadi menandai ulang yang sudah dibaca menghasilkan 0. Penyaring pemilik ada di perintah UPDATE-nya, jadi id milik akun lain tidak pernah tersentuh.

`GET /api/admin/opsi-saring` mengembalikan pilihan yang dipakai tampilan pantauan: `{ "data": { "kelas": [{ classId, namaKelas, cabang }], "guru": [{ guruId, guruNama }], "cabang": ["..."] } }`. Kelas dan cabang berasal dari tabel `classes`, sedangkan `guru` adalah akun yang perannya memuat `user` (akun owner/admin tidak ikut). Dijaga `jurnal: read-any`, jadi hanya owner yang bisa membacanya.

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
