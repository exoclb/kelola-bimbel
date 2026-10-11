import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

// Berkas ini mengunci tabel pengeluaran operasional (`expense_categories` dan
// `expenses`) tepat di tingkat basis data. Yang diuji bukan layanan atau
// halaman, melainkan janji tabelnya sendiri: kolom bertipe apa yang dibaca
// layanan pengeluaran, indeks yang membuat rekap tetap konsisten, dan batasan
// yang menahan baris salah walau ditulis langsung ke basis data.
//
// Satu hal yang sengaja diuji berpasangan: nama kategori harus unik tanpa
// membedakan huruf besar-kecil maupun spasi di tepi. Rekap pengeluaran
// dikelompokkan menurut nama kategori (`totalPerKategori`), jadi "Listrik" dan
// "listrik" bukan dua kategori yang berbeda — keduanya satu kategori, dan
// penjaganya indeks unik `expense_categories_nama_unik_idx`
// (`drizzle/0038_kategori_pengeluaran_nama_unik.sql`).
//
// Semua baris uji memakai nama dan tanggal bertanda "uji skema" pada tahun 2097
// supaya tidak bertabrakan dengan data sungguhan maupun berkas uji lain, dan
// dibersihkan sebelum maupun sesudah tiap tes.

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Awalan nama kategori milik berkas ini; dipakai juga untuk pembersihan. */
const AWALAN = "Kategori Uji Skema";

/** Hapus hanya baris milik berkas ini, termasuk pengeluarannya. */
async function bersihkan() {
  await pool.query(
    `DELETE FROM expenses
      WHERE kategori_id IN (
        SELECT id FROM expense_categories
         WHERE lower(btrim(nama)) LIKE lower($1) || '%'
      )`,
    [AWALAN],
  );
  await pool.query(
    "DELETE FROM expense_categories WHERE lower(btrim(nama)) LIKE lower($1) || '%'",
    [AWALAN],
  );
}

/** Satu kategori uji; mengembalikan id-nya. */
async function tambahKategori(nama) {
  const { rows } = await pool.query(
    "INSERT INTO expense_categories (nama) VALUES ($1) RETURNING id",
    [nama],
  );
  return rows[0].id;
}

/** `true` kalau query ditolak basis data dengan kode SQLSTATE yang diminta. */
async function ditolak(sql, values, kode) {
  try {
    await pool.query(sql, values);
  } catch (error) {
    assert.equal(error.code, kode, `ditolak dengan kode ${error.code}`);
    return true;
  }
  assert.fail(`seharusnya ditolak dengan kode ${kode}`);
}

test("tabel kategori pengeluaran memuat kolom dan batasan yang dipakai aplikasi", async () => {
  await bersihkan();

  // Kolom yang dibaca layanan pengeluaran: `id` untuk kunci, `nama` untuk label
  // yang juga dipakai sebagai pengelompok rekap, dan `created_at` untuk urutan
  // kanonik saat varian penulisan disatukan migrasi.
  const { rows: kolom } = await pool.query(
    `SELECT column_name, data_type, is_nullable, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'expense_categories'
      ORDER BY column_name`,
  );
  assert.deepEqual(
    kolom.map((baris) => baris.column_name),
    ["created_at", "id", "nama"],
  );

  const perKolom = Object.fromEntries(
    kolom.map((baris) => [baris.column_name, baris]),
  );
  assert.equal(perKolom.nama.data_type, "character varying");
  assert.equal(perKolom.nama.character_maximum_length, 80);
  assert.equal(perKolom.nama.is_nullable, "NO");
  assert.equal(perKolom.id.is_nullable, "NO");
  assert.equal(perKolom.created_at.is_nullable, "NO");

  // Nama kosong tidak berguna di daftar pilihan, jadi ditolak basis data.
  const { rows: batasan } = await pool.query(
    "SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace",
  );
  const namaBatasan = new Set(batasan.map((baris) => baris.conname));
  assert.ok(namaBatasan.has("expense_categories_nama_terisi"));

  await bersihkan();
});

test("nama kategori dijaga unik tanpa membedakan huruf besar-kecil dan spasi tepi", async () => {
  await bersihkan();

  // Indeks uniknya ada pada ekspresi `lower(btrim(nama))`, bukan pada kolomnya
  // langsung: kalau ekspresinya berubah, rekap per kategori bisa terbelah lagi
  // tanpa ada tes lain yang menangkapnya.
  const { rows: indeks } = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'expense_categories'`,
  );
  const unik = indeks.find(
    (baris) => baris.indexname === "expense_categories_nama_unik_idx",
  );
  assert.ok(unik, "indeks unik nama kategori ada");
  assert.match(unik.indexdef, /UNIQUE/);
  assert.match(unik.indexdef, /lower\(btrim\(\(nama\)::text\)\)/);

  const id = await tambahKategori(`${AWALAN} Sewa`);
  assert.ok(id);

  // Varian penulisan apa pun ditolak 23505, bukan tersimpan sebagai kategori
  // kedua yang memecah total di rekap.
  for (const varian of [
    `${AWALAN.toLowerCase()} sewa`,
    `  ${AWALAN} Sewa  `,
    `${AWALAN.toUpperCase()} SEWA`,
  ]) {
    assert.ok(
      await ditolak(
        "INSERT INTO expense_categories (nama) VALUES ($1)",
        [varian],
        "23505",
      ),
      `varian "${varian}" ditolak`,
    );
  }

  const { rows: jumlah } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM expense_categories WHERE lower(btrim(nama)) LIKE lower($1) || '%'",
    [AWALAN],
  );
  assert.equal(jumlah[0].jumlah, 1, "hanya kategori kanonik yang tersisa");

  // Kategori dengan nama yang memang berbeda tetap boleh dibuat.
  await tambahKategori(`${AWALAN} Listrik`);

  await bersihkan();
});

test("tabel pengeluaran memuat kolom, indeks, dan batasan yang dipakai rekap", async () => {
  await bersihkan();

  const { rows: kolom } = await pool.query(
    `SELECT column_name, data_type, is_nullable, numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'expenses'
      ORDER BY column_name`,
  );
  assert.deepEqual(
    kolom.map((baris) => baris.column_name),
    [
      "catatan",
      "created_at",
      "id",
      "kategori_id",
      "nominal",
      "tanggal",
      "updated_at",
    ],
  );

  const perKolom = Object.fromEntries(
    kolom.map((baris) => [baris.column_name, baris]),
  );
  // Nominal rupiah dua desimal seperti kolom keuangan lain; kalau presisinya
  // menyusut, nominal besar terpotong diam-diam.
  assert.equal(perKolom.nominal.data_type, "numeric");
  assert.equal(perKolom.nominal.numeric_precision, 12);
  assert.equal(perKolom.nominal.numeric_scale, 2);
  assert.equal(perKolom.nominal.is_nullable, "NO");
  // Tanggalnya kolom `date`, bukan teks: rekap per periode bergantung padanya.
  assert.equal(perKolom.tanggal.data_type, "date");
  assert.equal(perKolom.tanggal.is_nullable, "NO");
  // Catatan boleh kosong (dikembalikan sebagai teks kosong oleh layanan).
  assert.equal(perKolom.catatan.is_nullable, "YES");
  assert.ok(perKolom.kategori_id, "kolom kategori_id ada");

  const { rows: batasan } = await pool.query(
    "SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace",
  );
  const namaBatasan = new Set(batasan.map((baris) => baris.conname));
  for (const wajib of [
    "expenses_nominal_tidak_negatif",
    "expenses_tanggal_masuk_akal",
    "expenses_kategori_id_expense_categories_id_fk",
  ])
    assert.ok(namaBatasan.has(wajib), `batasan ${wajib} ada`);

  // Daftar dan rekap membaca urut tanggal dan menyaring per kategori, jadi
  // kedua indeks itu bagian dari kontrak tabelnya.
  const { rows: indeks } = await pool.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'expenses'`,
  );
  const namaIndeks = new Set(indeks.map((baris) => baris.indexname));
  for (const wajib of ["expenses_tanggal_idx", "expenses_kategori_idx"])
    assert.ok(namaIndeks.has(wajib), `indeks ${wajib} ada`);

  await bersihkan();
});

test("baris pengeluaran salah ditolak basis data walau ditulis langsung", async () => {
  await bersihkan();

  const kategoriId = await tambahKategori(`${AWALAN} Listrik`);
  await pool.query(
    "INSERT INTO expenses (kategori_id, nominal, tanggal, catatan) VALUES ($1, $2, $3, $4)",
    [kategoriId, 150000, "2097-03-10", "Uji skema"],
  );

  // Nominal negatif selalu salah hitung di rekap, jadi tidak boleh tersimpan.
  assert.ok(
    await ditolak(
      "INSERT INTO expenses (kategori_id, nominal, tanggal) VALUES ($1, $2, $3)",
      [kategoriId, -1, "2097-03-11"],
      "23514",
    ),
  );
  // Tanggal di luar rentang masuk akal membuat pengeluaran hilang dari rekap
  // periode yang sebenarnya.
  assert.ok(
    await ditolak(
      "INSERT INTO expenses (kategori_id, nominal, tanggal) VALUES ($1, $2, $3)",
      [kategoriId, 150000, "1999-12-31"],
      "23514",
    ),
  );
  // Nominal nol masih diterima basis data (validasi formulir yang menuntut
  // lebih dari nol); dikunci di sini supaya perubahannya disengaja.
  await pool.query(
    "INSERT INTO expenses (kategori_id, nominal, tanggal) VALUES ($1, $2, $3)",
    [kategoriId, 0, "2097-03-12"],
  );
  // Pengeluaran tanpa kategori tidak bisa menggantung: kuncinya asing.
  assert.ok(
    await ditolak(
      "INSERT INTO expenses (kategori_id, nominal, tanggal) VALUES ($1, $2, $3)",
      ["00000000-0000-4000-8000-000000000000", 150000, "2097-03-13"],
      "23503",
    ),
  );
  // Kategori yang masih dipakai pengeluaran tidak boleh hilang: riwayatnya
  // harus selalu punya kategorinya.
  assert.ok(
    await ditolak(
      "DELETE FROM expense_categories WHERE id = $1",
      [kategoriId],
      "23503",
    ),
  );

  const { rows: jumlah } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM expenses WHERE kategori_id = $1",
    [kategoriId],
  );
  assert.equal(jumlah[0].jumlah, 2, "hanya baris yang sah yang tersimpan");

  await bersihkan();
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});
