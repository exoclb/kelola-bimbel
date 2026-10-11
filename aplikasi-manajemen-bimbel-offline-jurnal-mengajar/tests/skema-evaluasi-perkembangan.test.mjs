import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// Berkas ini mengunci skema dan migrasi tabel `student_progress` — catatan
// evaluasi perkembangan belajar anak (nilai, sikap, dan uraian dari guru) —
// tepat di tingkat basis data. Yang diuji bukan layanan atau halaman,
// melainkan janji tabelnya sendiri: batasan yang seharusnya menahan baris salah
// walau ditulis langsung, relasi ke murid dan guru penulisnya, serta aturan
// "boleh lebih dari satu catatan pada hari yang sama" yang memang dipakai
// layanannya.
//
// Penandanya unik per proses supaya berkas ini aman berjalan bersamaan dengan
// berkas uji basis data lain yang memakai satu database uji yang sama.

const PENANDA = `Uji Skema Evaluasi ${process.pid}-${randomUUID().slice(0, 8)}`;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Bersihkan hanya baris milik berkas ini, urut dari yang paling bergantung. */
async function bersihkan() {
  await pool.query(
    `DELETE FROM student_progress
      WHERE student_id IN (SELECT id FROM students WHERE nama LIKE $1)
         OR guru_id IN (SELECT id FROM "user" WHERE name LIKE $1)`,
    [`${PENANDA}%`],
  );
  await pool.query("DELETE FROM students WHERE nama LIKE $1", [`${PENANDA}%`]);
  await pool.query('DELETE FROM "user" WHERE name LIKE $1', [`${PENANDA}%`]);
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

/** Satu akun guru penulis catatan, dengan email unik milik berkas ini. */
async function buatGuru(akhiran = "Guru") {
  const { rows } = await pool.query(
    'INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3) RETURNING id',
    [
      `${PENANDA}-${akhiran}`,
      `${PENANDA} ${akhiran}`,
      `${PENANDA.replaceAll(" ", "-").toLowerCase()}-${akhiran}@example.com`,
    ],
  );
  return rows[0];
}

/** Satu murid uji. */
async function buatMurid(akhiran = "Anak") {
  const { rows } = await pool.query(
    "INSERT INTO students (nama) VALUES ($1) RETURNING id",
    [`${PENANDA} ${akhiran}`],
  );
  return rows[0];
}

/** Satu catatan evaluasi; nilainya boleh diubah supaya batasnya bisa diuji. */
async function tulisCatatan(
  muridId,
  guruId,
  {
    nilai = 80,
    sikap = "Baik",
    catatan = "Lancar berhitung.",
    tanggal = "2026-03-02",
  } = {},
) {
  const { rows } = await pool.query(
    `INSERT INTO student_progress
       (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [muridId, guruId, tanggal, nilai, sikap, catatan],
  );
  return rows[0];
}

test("skema catatan evaluasi memuat kolom serta batasan yang dipakai aplikasi", async () => {
  await bersihkan();

  // Kolom yang dibaca layanan dan halaman. Kalau ada yang dihapus atau diganti
  // nama, migrasinya tidak lagi cocok dengan kode dan tes ini gagal lebih dulu.
  const kolom = (
    await pool.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'student_progress'`,
    )
  ).rows.map((baris) => baris.column_name);
  assert.deepEqual(kolom.sort(), [
    "catatan_perkembangan",
    "created_at",
    "guru_id",
    "id",
    "nilai",
    "sikap",
    "student_id",
    "tanggal",
    "updated_at",
  ]);

  // Batasannya sendiri: rentang nilai, sikap yang tidak boleh kosong, dan dua
  // kunci asing yang menyambungkannya ke murid serta guru penulisnya.
  const { rows: batasan } = await pool.query(
    `SELECT conname FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace`,
  );
  const namaBatasan = new Set(batasan.map((baris) => baris.conname));
  for (const wajib of [
    "student_progress_nilai_rentang",
    "student_progress_sikap_terisi",
    "student_progress_student_id_students_id_fk",
    "student_progress_guru_id_user_id_fk",
  ])
    assert.ok(namaBatasan.has(wajib), `batasan ${wajib} ada`);

  // Indeks riwayat per anak (`student_id`, `tanggal`) dan per guru; keduanya
  // dipakai daftar riwayat dan laporan agregat.
  const { rows: indeks } = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const namaIndeks = new Set(indeks.map((baris) => baris.indexname));
  assert.ok(namaIndeks.has("student_progress_student_tanggal_idx"));
  assert.ok(namaIndeks.has("student_progress_guru_idx"));
});

test("nilai di luar 0 sampai 100 ditolak basis data", async () => {
  await bersihkan();
  const guru = await buatGuru("Nilai");
  const murid = await buatMurid("Nilai");

  // Nilai itu dipakai di rata-rata laporan dan dibandingkan langsung dengan
  // `z.number().min(0).max(100)`; baris di luar rentang membuat laporannya
  // tidak bisa dipercaya.
  assert.ok(
    await ditolak(
      `INSERT INTO student_progress
         (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan)
       VALUES ($1, $2, '2026-03-02', $3, 'Baik', '')`,
      [murid.id, guru.id, -1],
      "23514",
    ),
  );
  assert.ok(
    await ditolak(
      `INSERT INTO student_progress
         (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan)
       VALUES ($1, $2, '2026-03-02', $3, 'Baik', '')`,
      [murid.id, guru.id, 101],
      "23514",
    ),
  );

  // Kedua ujung rentangnya sah, supaya batasannya tidak terlalu ketat.
  assert.ok((await tulisCatatan(murid.id, guru.id, { nilai: 0 })).id);
  assert.ok((await tulisCatatan(murid.id, guru.id, { nilai: 100 })).id);
});

test("sikap kosong ditolak tetapi uraian catatan boleh dikosongkan", async () => {
  await bersihkan();
  const guru = await buatGuru("Sikap");
  const murid = await buatMurid("Sikap");

  // Spasi saja sama tidak terpakainya dengan kosong: sikap ditampilkan sebagai
  // kolom ringkas di kartu perkembangan dan laporan ke orang tua, jadi baris
  // seperti itu muncul sebagai celah kosong di layar.
  for (const sikap of ["", "   "])
    assert.ok(
      await ditolak(
        `INSERT INTO student_progress
           (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan)
         VALUES ($1, $2, '2026-03-02', 80, $3, '')`,
        [murid.id, guru.id, sikap],
        "23514",
      ),
      `sikap ${JSON.stringify(sikap)} ditolak`,
    );

  // Uraian catatan justru boleh kosong: guru sering mengisi nilai dan sikap
  // lebih dulu, uraiannya menyusul. Itu bawaan `createPerkembanganSchema`.
  const tanpaUraian = await tulisCatatan(murid.id, guru.id, {
    catatan: "",
    sikap: "Cukup",
  });
  assert.ok(tanpaUraian.id);
});

test("catatan menunjuk murid dan guru yang terdaftar, dan ikut terhapus bersamanya", async () => {
  await bersihkan();
  const guru = await buatGuru("Relasi");
  const guruLain = await buatGuru("Relasi Lain");
  const murid = await buatMurid("Relasi");
  const muridLain = await buatMurid("Relasi Lain");

  // Murid atau guru yang tidak ada tidak bisa dipakai menulis catatan.
  assert.ok(
    await ditolak(
      `INSERT INTO student_progress
         (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan)
       VALUES ($1, $2, '2026-03-02', 80, 'Baik', '')`,
      [randomUUID(), guru.id],
      "23503",
    ),
  );
  assert.ok(
    await ditolak(
      `INSERT INTO student_progress
         (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan)
       VALUES ($1, $2, '2026-03-02', 80, 'Baik', '')`,
      [murid.id, `${PENANDA}-guru-hantu`],
      "23503",
    ),
  );

  await tulisCatatan(murid.id, guru.id);
  await tulisCatatan(muridLain.id, guruLain.id);

  const jumlahSeorang = async (muridId) =>
    (
      await pool.query(
        "SELECT count(*)::int AS jumlah FROM student_progress WHERE student_id = $1",
        [muridId],
      )
    ).rows[0].jumlah;

  // Menghapus murid ikut menghapus catatannya, tetapi tidak menyentuh catatan
  // murid lain — riwayat anak lain tidak boleh ikut hilang.
  await pool.query("DELETE FROM students WHERE id = $1", [murid.id]);
  assert.equal(await jumlahSeorang(murid.id), 0);
  assert.equal(await jumlahSeorang(muridLain.id), 1);

  // Menghapus akun guru ikut menghapus catatan yang ditulisnya; `guru_id`
  // wajib terisi sehingga tidak bisa di-`set null` seperti pengampu kelas.
  await pool.query('DELETE FROM "user" WHERE id = $1', [guruLain.id]);
  assert.equal(await jumlahSeorang(muridLain.id), 0);

  await bersihkan();
});

test("beberapa catatan pada hari yang sama tetap boleh", async () => {
  await bersihkan();
  const guru = await buatGuru("Harian");
  const murid = await buatMurid("Harian");

  // Guru bisa mencatat beberapa hal sekaligus dalam sehari, dan catatannya bisa
  // diperbaiki kemudian; tabelnya sengaja tidak punya kunci unik
  // (murid, tanggal). Kalau indeks seperti itu muncul lagi, catatan kedua di
  // hari yang sama akan ditolak tanpa penjelasan.
  await tulisCatatan(murid.id, guru.id, { tanggal: "2026-03-02", nilai: 70 });
  await tulisCatatan(murid.id, guru.id, { tanggal: "2026-03-02", nilai: 90 });

  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM student_progress WHERE student_id = $1",
    [murid.id],
  );
  assert.equal(rows[0].jumlah, 2);

  const { rows: unik } = await pool.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'student_progress'
        AND indexdef LIKE '%UNIQUE%'
        AND indexname <> 'student_progress_pkey'`,
  );
  assert.deepEqual(unik, []);

  await bersihkan();
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});
