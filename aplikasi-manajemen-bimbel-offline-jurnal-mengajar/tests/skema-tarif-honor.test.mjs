import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

// Berkas ini mengunci tabel tarif honor (`salary_settings`) tepat di tingkat
// basis data. Yang diuji bukan layanan atau halaman, melainkan janji tabelnya
// sendiri: kolom bertipe apa yang dibaca layanan gaji, batasan yang menahan
// baris salah walau ditulis langsung, dan aturan "satu tarif per tanggal
// berlaku" yang membuat riwayat tarif bisa dibaca urut.
//
// Semua baris uji memakai tanggal di tahun 2097 supaya tidak bertabrakan
// dengan tarif sungguhan maupun dengan berkas uji lain (e2e memakai 2098 dan
// 2099), dan dibersihkan sebelum maupun sesudah tiap tes.

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Tanggal uji di 2097: `hari(1)` → "2097-01-01". */
const hari = (nomor) => `2097-01-${String(nomor).padStart(2, "0")}`;

/** Hapus hanya baris milik berkas ini. */
async function bersihkan() {
  await pool.query(
    "DELETE FROM salary_settings WHERE berlaku_sejak BETWEEN $1 AND $2",
    [hari(1), hari(9)],
  );
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

/** Satu aturan tarif uji; `skema` yang tidak dikirim memakai bawaan tabel. */
async function tambahTarif(tarifPerJam, berlakuSejak, skema) {
  const { rows } = await pool.query(
    `INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak)
     VALUES ($1, coalesce($2, 'per jam'), $3)
     RETURNING id, tarif_per_jam, skema, berlaku_sejak`,
    [tarifPerJam, skema ?? null, berlakuSejak],
  );
  return rows[0];
}

test("skema tabel tarif honor memuat kolom dan batasan yang dipakai aplikasi", async () => {
  await bersihkan();

  // Kolom yang dibaca layanan gaji dan halaman pengaturan. Kalau ada yang
  // dihapus atau diganti nama, migrasinya tidak lagi cocok dengan kode dan tes
  // ini gagal lebih dulu.
  const { rows: kolom } = await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default,
            numeric_precision, numeric_scale, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'salary_settings'
      ORDER BY column_name`,
  );
  assert.deepEqual(
    kolom.map((baris) => baris.column_name),
    ["berlaku_sejak", "created_at", "id", "skema", "tarif_per_jam"],
  );

  // Bentuk tiap kolom: tarif dua desimal, skema teks pendek berbawaan, dan
  // tanggal berlaku tidak boleh kosong. Salah tipe di sini membuat pembacaan
  // tarif menghasilkan angka aneh tanpa galat.
  const perKolom = Object.fromEntries(
    kolom.map((baris) => [baris.column_name, baris]),
  );
  assert.equal(perKolom.tarif_per_jam.data_type, "numeric");
  assert.equal(perKolom.tarif_per_jam.numeric_precision, 12);
  assert.equal(perKolom.tarif_per_jam.numeric_scale, 2);
  assert.equal(perKolom.tarif_per_jam.is_nullable, "NO");
  assert.equal(perKolom.skema.data_type, "character varying");
  assert.equal(perKolom.skema.character_maximum_length, 40);
  assert.equal(perKolom.skema.is_nullable, "NO");
  assert.match(perKolom.skema.column_default, /'per jam'/);
  assert.equal(perKolom.berlaku_sejak.data_type, "date");
  assert.equal(perKolom.berlaku_sejak.is_nullable, "NO");

  // Batasannya sendiri: tarif tidak boleh negatif, skema tidak boleh kosong,
  // dan tanggal berlaku tidak boleh punya dua tarif.
  const { rows: batasan } = await pool.query(
    "SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace",
  );
  const namaBatasan = new Set(batasan.map((baris) => baris.conname));
  for (const wajib of [
    "salary_settings_tarif_tidak_negatif",
    "salary_settings_skema_terisi",
  ])
    assert.ok(namaBatasan.has(wajib), `batasan ${wajib} ada`);

  const { rows: indeks } = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'salary_settings'`,
  );
  const riwayat = indeks.find(
    (baris) => baris.indexname === "salary_settings_berlaku_sejak_idx",
  );
  assert.ok(riwayat, "indeks tanggal berlaku ada");
  assert.match(riwayat.indexdef, /UNIQUE/);
  assert.match(riwayat.indexdef, /\(berlaku_sejak\)/);

  await bersihkan();
});

test("tarif negatif ditolak basis data, nol tetap diterima", async () => {
  await bersihkan();

  assert.ok(
    await ditolak(
      "INSERT INTO salary_settings (tarif_per_jam, berlaku_sejak) VALUES ($1, $2)",
      [-1, hari(1)],
      "23514",
    ),
  );
  // Nilai minus selalu salah hitung di rekap honor, jadi barisnya tidak boleh
  // sempat tersimpan.
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS jumlah FROM salary_settings WHERE berlaku_sejak = $1",
        [hari(1)],
      )
    ).rows[0].jumlah,
    0,
  );

  // Nol masih mungkin (mis. kelas sukarela) dan harus tetap bisa disimpan.
  const nol = await tambahTarif(0, hari(1));
  assert.equal(Number(nol.tarif_per_jam), 0);

  // Tarif berbawaan tidak dikirim tetap "per jam", bukan teks kosong.
  assert.equal(nol.skema, "per jam");

  await bersihkan();
});

test("skema honor yang kosong atau hanya spasi ditolak basis data", async () => {
  await bersihkan();

  for (const kosong of ["", "   "]) {
    assert.ok(
      await ditolak(
        `INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak)
         VALUES ($1, $2, $3)`,
        [100000, kosong, hari(2)],
        "23514",
      ),
    );
  }

  // Skema yang benar tetap boleh masuk, termasuk yang bukan "per jam".
  const tetap = await tambahTarif(500000, hari(2), "tetap");
  assert.equal(tetap.skema, "tetap");

  await bersihkan();
});

test("satu tanggal berlaku hanya boleh punya satu tarif", async () => {
  await bersihkan();

  await tambahTarif(60000, hari(3));

  // Baris kedua pada tanggal yang sama ditolak indeks unik, sehingga
  // `aturanTarifBerlaku` tidak pernah harus memilih di antara dua tarif.
  assert.ok(
    await ditolak(
      `INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak)
       VALUES ($1, $2, $3)`,
      [70000, "per jam", hari(3)],
      "23505",
    ),
  );

  // Tanggal lain tetap boleh, dan riwayatnya terbaca urut terbaru dulu —
  // urutan itu yang dipakai layanan gaji untuk memilih tarif.
  await tambahTarif(90000, hari(4));
  const { rows } = await pool.query(
    `SELECT tarif_per_jam FROM salary_settings
      WHERE berlaku_sejak BETWEEN $1 AND $2
      ORDER BY berlaku_sejak DESC`,
    [hari(3), hari(4)],
  );
  assert.deepEqual(
    rows.map((baris) => Number(baris.tarif_per_jam)),
    [90000, 60000],
  );

  await bersihkan();
});

test("tanggal berlaku wajib diisi", async () => {
  await bersihkan();

  // Tanpa tanggal berlaku, tarif tidak bisa diurutkan maupun dipilih, jadi
  // basis data yang harus menolaknya — bukan hanya formulir halaman.
  assert.ok(
    await ditolak(
      "INSERT INTO salary_settings (tarif_per_jam) VALUES ($1)",
      [50000],
      "23502",
    ),
  );

  await bersihkan();
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});
