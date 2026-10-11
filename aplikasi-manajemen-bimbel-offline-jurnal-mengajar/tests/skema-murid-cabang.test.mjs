import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// Berkas ini mengunci skema dan migrasi tiga tabel milik fitur "Manajemen
// Murid, Multi-Kelas & Cabang" — `cabang`, `students`, dan `student_enrollments`
// (penempatan murid ke kelas) — tepat di tingkat basis data. Yang diuji bukan
// layanan atau halaman, melainkan janji tabelnya sendiri: batasan yang
// seharusnya menahan baris salah walau ditulis langsung, relasi kelas → cabang
// yang ikut berpindah saat cabang diganti nama, dan penempatan yang boleh
// multi-kelas tetapi tidak boleh dobel di kelas yang sama.
//
// Kelas dan muridnya selalu diberi penanda unik per proses supaya berkas ini
// aman berjalan bersamaan dengan berkas uji basis data lain yang memakai satu
// database uji yang sama.

const PENANDA = `Uji Skema Murid ${process.pid}-${randomUUID().slice(0, 8)}`;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Bersihkan hanya baris milik berkas ini, urut dari yang paling bergantung. */
async function bersihkan() {
  await pool.query(
    `DELETE FROM student_enrollments
      WHERE student_id IN (SELECT id FROM students WHERE nama LIKE $1)
         OR class_id IN (SELECT id FROM classes WHERE nama_kelas LIKE $1)`,
    [`${PENANDA}%`],
  );
  await pool.query("DELETE FROM classes WHERE nama_kelas LIKE $1", [
    `${PENANDA}%`,
  ]);
  await pool.query("DELETE FROM students WHERE nama LIKE $1", [`${PENANDA}%`]);
  await pool.query("DELETE FROM cabang WHERE nama LIKE $1", [`${PENANDA}%`]);
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

/** Satu cabang uji, aktif, dengan nama yang unik untuk berkas ini. */
async function buatCabang(akhiran = "Alfa") {
  const { rows } = await pool.query(
    `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
     VALUES ($1, $2, $3, true) RETURNING id, nama`,
    [`${PENANDA} ${akhiran}`, `Jl. Uji ${akhiran}`, `0800-${akhiran}`],
  );
  return rows[0];
}

/** Satu kelas uji di cabang yang sudah ada. */
async function buatKelas(namaCabang, akhiran = "Kelas") {
  const { rows } = await pool.query(
    "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2) RETURNING id",
    [`${PENANDA} ${akhiran}`, namaCabang],
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

/** Tempatkan murid di kelas pada tanggal tertentu. */
async function tempatkan(muridId, kelasId, tanggalMulai = "2026-02-01") {
  const { rows } = await pool.query(
    `INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai)
     VALUES ($1, $2, $3) RETURNING id`,
    [muridId, kelasId, tanggalMulai],
  );
  return rows[0];
}

test("skema cabang, murid, dan penempatan memuat kolom serta batasan yang dipakai aplikasi", async () => {
  await bersihkan();

  // Kolom yang dibaca layanan dan halaman. Kalau ada yang dihapus atau diganti
  // nama, migrasinya tidak lagi cocok dengan kode dan tes ini gagal lebih dulu.
  const kolom = async (tabel) =>
    (
      await pool.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [tabel],
      )
    ).rows.map((baris) => baris.column_name);

  assert.deepEqual(
    (await kolom("cabang")).sort(),
    [
      "alamat",
      "created_at",
      "id",
      "kontak",
      "nama",
      "status_aktif",
      "updated_at",
    ].sort(),
  );
  assert.deepEqual(
    (await kolom("students")).sort(),
    [
      "created_at",
      "id",
      "kontak_orang_tua",
      "nama",
      "nama_orang_tua",
      "status_aktif",
      "tanggal_lahir",
    ].sort(),
  );
  assert.deepEqual(
    (await kolom("student_enrollments")).sort(),
    [
      "class_id",
      "created_at",
      "id",
      "status",
      "student_id",
      "tanggal_mulai",
    ].sort(),
  );

  // Batasannya sendiri: isian wajib yang tidak boleh kosong, nama cabang yang
  // unik tanpa membedakan huruf besar-kecil, penempatan aktif yang unik per
  // pasangan, dan dua kunci asing yang menyambungkan ketiga tabel itu.
  const { rows: batasan } = await pool.query(
    `SELECT conname FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace`,
  );
  const namaBatasan = new Set(batasan.map((baris) => baris.conname));
  for (const wajib of [
    "cabang_nama_terisi",
    "cabang_alamat_terisi",
    "cabang_kontak_terisi",
    "cabang_nama_unique",
    "students_nama_terisi",
    "classes_nama_kelas_terisi",
    "classes_cabang_cabang_nama_fk",
    "student_enrollments_student_id_students_id_fk",
    "student_enrollments_class_id_classes_id_fk",
  ])
    assert.ok(namaBatasan.has(wajib), `batasan ${wajib} ada`);

  const { rows: indeks } = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
  );
  const namaIndeks = new Set(indeks.map((baris) => baris.indexname));
  assert.ok(namaIndeks.has("cabang_nama_unik_idx"));
  assert.ok(namaIndeks.has("student_enrollments_student_kelas_aktif_idx"));
  assert.ok(namaIndeks.has("classes_cabang_idx"));
  // Indeks lama "satu murid satu kelas" sudah diganti aturan multi-kelas. Kalau
  // ia muncul lagi, murid yang belajar di kelas matematika dan bahasa akan
  // ditolak tanpa penjelasan.
  assert.ok(!namaIndeks.has("student_enrollments_student_aktif_idx"));
});

test("nama murid dan nama kelas yang kosong ditolak basis data", async () => {
  await bersihkan();
  const cabang = await buatCabang("Isian");

  // Spasi saja sama tidak terpakainya dengan kosong: baris seperti itu tidak
  // bisa dicari, ditampilkan, atau dikenali di laporan mana pun.
  assert.ok(
    await ditolak("INSERT INTO students (nama) VALUES ($1)", [""], "23514"),
  );
  assert.ok(
    await ditolak("INSERT INTO students (nama) VALUES ($1)", ["   "], "23514"),
  );
  assert.ok(
    await ditolak(
      "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2)",
      ["", cabang.nama],
      "23514",
    ),
  );
  assert.ok(
    await ditolak(
      "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2)",
      ["   ", cabang.nama],
      "23514",
    ),
  );

  // Yang benar tetap boleh masuk, supaya batasannya tidak terlalu ketat.
  const murid = await buatMurid("Isian");
  assert.ok(murid.id);
  assert.ok((await buatKelas(cabang.nama, "Isian")).id);
});

test("kelas wajib menunjuk cabang terdaftar dan ikut pindah saat cabangnya diganti nama", async () => {
  await bersihkan();
  const cabang = await buatCabang("Relasi");

  // Cabang yang tidak ada tidak bisa dipakai kelas.
  assert.ok(
    await ditolak(
      "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2)",
      [`${PENANDA} Kelas Tanpa Cabang`, `${PENANDA} Cabang Hantu`],
      "23503",
    ),
  );

  const kelas = await buatKelas(cabang.nama, "Relasi");

  // Ganti nama cabang: kelasnya mengikuti (`on update cascade`), jadi kelas
  // tidak pernah menunjuk nama cabang yang sudah tidak ada.
  const namaBaru = `${cabang.nama} Baru`;
  await pool.query("UPDATE cabang SET nama = $1 WHERE id = $2", [
    namaBaru,
    cabang.id,
  ]);
  const { rows: setelahGanti } = await pool.query(
    "SELECT cabang FROM classes WHERE id = $1",
    [kelas.id],
  );
  assert.equal(setelahGanti[0].cabang, namaBaru);

  // Cabang nonaktif tetap terdaftar dan tidak memutus kelas lama; yang berubah
  // hanya aturan layanan untuk kelas baru.
  await pool.query("UPDATE cabang SET status_aktif = false WHERE id = $1", [
    cabang.id,
  ]);
  assert.equal(
    (await pool.query("SELECT cabang FROM classes WHERE id = $1", [kelas.id]))
      .rows[0].cabang,
    namaBaru,
  );
  assert.equal(
    (
      await pool.query("SELECT status_aktif FROM cabang WHERE id = $1", [
        cabang.id,
      ])
    ).rows[0].status_aktif,
    false,
  );

  // Cabang yang masih dipakai kelas tidak bisa dihapus, jadi penempatan murid
  // tidak bisa kehilangan kelasnya diam-diam.
  assert.ok(
    await ditolak("DELETE FROM cabang WHERE id = $1", [cabang.id], "23503"),
  );
});

test("nama cabang unik tanpa membedakan huruf besar-kecil dan spasi tepi", async () => {
  await bersihkan();
  const cabang = await buatCabang("Unik");

  assert.ok(
    await ditolak(
      `INSERT INTO cabang (nama, alamat, kontak)
       VALUES ($1, 'Jl. Uji', '0800')`,
      [` ${cabang.nama.toUpperCase()} `],
      "23505",
    ),
  );

  // Isian wajibnya juga tidak boleh kosong, sama seperti namanya.
  for (const [kolom, nilai] of [
    ["nama", "   "],
    ["alamat", ""],
    ["kontak", "  "],
  ])
    assert.ok(
      await ditolak(
        `INSERT INTO cabang (nama, alamat, kontak)
         VALUES ($1, $2, $3)`,
        [
          kolom === "nama" ? nilai : `${PENANDA} Lain`,
          kolom === "alamat" ? nilai : "Jl. Uji",
          kolom === "kontak" ? nilai : "0800",
        ],
        "23514",
      ),
      `${kolom} kosong ditolak`,
    );
});

test("penempatan murid boleh multi-kelas tetapi tidak boleh dobel di kelas yang sama", async () => {
  await bersihkan();
  const cabang = await buatCabang("Penempatan");
  const kelasA = await buatKelas(cabang.nama, "Penempatan A");
  const kelasB = await buatKelas(cabang.nama, "Penempatan B");
  const murid = await buatMurid("Penempatan");

  await tempatkan(murid.id, kelasA.id, "2026-02-01");

  // Kelas lain boleh: itulah aturan multi-kelas.
  await tempatkan(murid.id, kelasB.id, "2026-02-15");

  // Kelas yang sama dua kali dalam status aktif ditolak indeks unik parsial.
  assert.ok(
    await ditolak(
      `INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai)
       VALUES ($1, $2, '2026-03-01')`,
      [murid.id, kelasA.id],
      "23505",
    ),
  );

  // Riwayat yang sudah selesai tidak menghalangi penempatan berikutnya: murid
  // boleh kembali ke kelas yang pernah ditinggalkannya.
  await pool.query(
    `UPDATE student_enrollments SET status = 'selesai'
      WHERE student_id = $1 AND class_id = $2`,
    [murid.id, kelasA.id],
  );
  await tempatkan(murid.id, kelasA.id, "2026-04-01");

  const { rows } = await pool.query(
    `SELECT class_id, status FROM student_enrollments
      WHERE student_id = $1 ORDER BY tanggal_mulai`,
    [murid.id],
  );
  assert.deepEqual(rows, [
    { class_id: kelasA.id, status: "selesai" },
    { class_id: kelasB.id, status: "aktif" },
    { class_id: kelasA.id, status: "aktif" },
  ]);

  // Status di luar daftar tidak bisa masuk walau ditulis langsung.
  assert.ok(
    await ditolak(
      `INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status)
       VALUES ($1, $2, '2026-05-01', 'pindah')`,
      [murid.id, kelasB.id],
      "22P02",
    ),
  );
});

test("menghapus murid atau kelas ikut membersihkan penempatannya", async () => {
  await bersihkan();
  const cabang = await buatCabang("Cascade");
  const kelasA = await buatKelas(cabang.nama, "Cascade A");
  const kelasB = await buatKelas(cabang.nama, "Cascade B");
  const muridA = await buatMurid("Cascade A");
  const muridB = await buatMurid("Cascade B");

  await tempatkan(muridA.id, kelasA.id);
  await tempatkan(muridA.id, kelasB.id);
  await tempatkan(muridB.id, kelasA.id);

  const jumlahSeorang = async (muridId) =>
    (
      await pool.query(
        "SELECT count(*)::int AS jumlah FROM student_enrollments WHERE student_id = $1",
        [muridId],
      )
    ).rows[0].jumlah;

  // Menghapus murid ikut menghapus kedua penempatannya, tetapi tidak menyentuh
  // penempatan murid lain di kelas yang sama.
  await pool.query("DELETE FROM students WHERE id = $1", [muridA.id]);
  assert.equal(await jumlahSeorang(muridA.id), 0);
  assert.equal(await jumlahSeorang(muridB.id), 1);

  // Menghapus kelas ikut menghapus penempatan murid di kelas itu.
  await pool.query("DELETE FROM classes WHERE id = $1", [kelasA.id]);
  assert.equal(await jumlahSeorang(muridB.id), 0);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS jumlah FROM student_enrollments WHERE class_id = $1",
        [kelasA.id],
      )
    ).rows[0].jumlah,
    0,
  );

  await bersihkan();
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});
