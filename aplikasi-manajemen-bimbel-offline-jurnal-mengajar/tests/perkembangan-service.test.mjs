import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";
import { Pool } from "pg";

const {
  createCatatanPerkembangan,
  getCatatanPerkembangan,
  getRiwayatPerkembangan,
  hapusCatatanPerkembangan,
  listCatatanPerkembangan,
  listCatatanPerkembanganAnak,
  listCatatanTerbaruPerMurid,
  listRingkasanPerkembangan,
  updateCatatanPerkembangan,
} = await import("../src/services/perkembangan.service.ts");

// Berkas ini menguji layanan catatan evaluasi perkembangan langsung, bukan
// lewat peramban. Sampai sekarang aturannya baru dikunci dua tempat: batas
// isian formulir (`tests/validasi-evaluasi.test.mjs`) dan alur HTTP
// (`e2e/perkembangan.spec.ts`). Yang belum pernah diuji adalah janji layanan
// itu sendiri — termasuk **validasi nilai**: nilai 0–100 dijaga validator API,
// tetapi layanan dan basis data harus tetap menolaknya kalau dipanggil dari
// jalur lain, dan itu yang dibuktikan di sini bersama penyaringan, pemilihan
// catatan terbaru, dan laporan agregatnya.
//
// Penandanya unik per proses supaya berkas ini aman berjalan bersamaan dengan
// berkas uji basis data lain yang memakai satu database uji yang sama.

const PENANDA = `Uji Layanan Evaluasi ${process.pid}-${randomUUID().slice(0, 8)}`;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000,
});

/** Hapus baris uji berkas ini, urut dari yang paling bergantung. */
async function bersihkan() {
  const muridUji = `SELECT id FROM students WHERE nama LIKE $1`;
  const guruUji = `SELECT id FROM "user" WHERE name LIKE $1`;
  await pool.query(
    `DELETE FROM journal_attendances
      WHERE student_id IN (${muridUji})
         OR journal_id IN (SELECT id FROM teaching_journals
                            WHERE guru_id IN (${guruUji}))`,
    [`${PENANDA}%`],
  );
  await pool.query(
    `DELETE FROM teaching_journals WHERE guru_id IN (${guruUji})`,
    [`${PENANDA}%`],
  );
  await pool.query(
    `DELETE FROM student_progress
      WHERE student_id IN (${muridUji}) OR guru_id IN (${guruUji})`,
    [`${PENANDA}%`],
  );
  await pool.query("DELETE FROM classes WHERE nama_kelas LIKE $1", [
    `${PENANDA}%`,
  ]);
  await pool.query("DELETE FROM cabang WHERE nama LIKE $1", [`${PENANDA}%`]);
  await pool.query("DELETE FROM students WHERE nama LIKE $1", [`${PENANDA}%`]);
  await pool.query('DELETE FROM "user" WHERE name LIKE $1', [`${PENANDA}%`]);
}

/** Satu akun guru penulis catatan. */
async function buatGuru(akhiran = "Guru") {
  const id = `${PENANDA}-${akhiran}`;
  await pool.query(
    'INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [
      id,
      `${PENANDA} ${akhiran}`,
      `${PENANDA.replaceAll(" ", "-").toLowerCase()}-${akhiran}@example.test`,
      "user",
    ],
  );
  return { id, nama: `${PENANDA} ${akhiran}` };
}

/** Satu murid uji. */
async function buatMurid(akhiran = "Anak") {
  const { rows } = await pool.query(
    "INSERT INTO students (nama) VALUES ($1) RETURNING id",
    [`${PENANDA} ${akhiran}`],
  );
  return { id: rows[0].id, nama: `${PENANDA} ${akhiran}` };
}

/**
 * Menulis satu baris catatan langsung ke basis data. Dipakai hanya untuk
 * menyiapkan keadaan awal (mis. beberapa catatan pada tanggal berbeda);
 * perilaku yang diuji tetap lewat layanan. `dibuat` mengisi `created_at`
 * supaya urutan dua catatan di hari yang sama bisa ditentukan tes.
 */
async function tulisLangsung(
  muridId,
  guruId,
  {
    nilai = 80,
    sikap = "Baik",
    catatan = "Lancar berhitung.",
    tanggal = "2026-03-02",
    dibuat = null,
  } = {},
) {
  const { rows } = await pool.query(
    `INSERT INTO student_progress
       (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now()))
     RETURNING id`,
    [muridId, guruId, tanggal, nilai, sikap, catatan, dibuat],
  );
  return rows[0].id;
}

/**
 * Satu jurnal mengajar beserta kehadiran seorang murid di dalamnya. Jurnal
 * adalah satu-satunya sumber kehadiran, jadi rekap laporan harus bisa
 * memadukannya dengan catatan evaluasi.
 */
async function tulisKehadiran({
  guruId,
  muridId,
  tanggal,
  hadir = true,
  kelasId,
}) {
  const { rows } = await pool.query(
    `INSERT INTO teaching_journals
       (guru_id, class_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, $3, 'Materi uji', 1.5) RETURNING id`,
    [guruId, kelasId, tanggal],
  );
  await pool.query(
    `INSERT INTO journal_attendances (journal_id, student_id, hadir, catatan)
     VALUES ($1, $2, $3, '')`,
    [rows[0].id, muridId, hadir],
  );
}

/** Satu kelas uji beserta cabangnya; jurnal wajib menunjuk kelas. */
async function buatKelas() {
  const namaCabang = `${PENANDA} Cabang`;
  await pool.query(
    `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
     VALUES ($1, 'Jl. Uji No. 1', '0800-1', true)`,
    [namaCabang],
  );
  const { rows } = await pool.query(
    "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2) RETURNING id",
    [`${PENANDA} Kelas`, namaCabang],
  );
  return rows[0].id;
}

/** Filter laporan/daftar dengan seluruh kolom wajibnya terisi. */
function filter(tambahan = {}) {
  return {
    limit: 50,
    offset: 0,
    muridId: undefined,
    dari: undefined,
    sampai: undefined,
    cari: undefined,
    ...tambahan,
  };
}

/** Kode SQLSTATE dari galat drizzle, yang membungkus galat asli `pg`. */
function kodeSql(error) {
  return error?.code ?? error?.cause?.code;
}

test("catatan baru tersimpan lengkap dengan nama anak dan guru penulisnya", async () => {
  await bersihkan();
  const guru = await buatGuru("Penulis");
  const murid = await buatMurid("Penulis");

  const hasil = await createCatatanPerkembangan(guru.id, {
    muridId: murid.id,
    tanggal: "2026-03-02",
    nilai: 85,
    sikap: "Sangat baik",
    catatanPerkembangan: "Sudah lancar perkalian.",
  });

  assert.equal(hasil.status, "tersimpan");
  assert.equal(hasil.catatan.muridId, murid.id);
  assert.equal(hasil.catatan.muridNama, murid.nama);
  assert.equal(hasil.catatan.guruId, guru.id);
  assert.equal(hasil.catatan.guruNama, guru.nama);
  assert.equal(hasil.catatan.tanggal, "2026-03-02");
  // Nilainya angka, bukan teks: halaman merata-ratakan kolom ini.
  assert.equal(typeof hasil.catatan.nilai, "number");
  assert.equal(hasil.catatan.nilai, 85);
  assert.equal(hasil.catatan.sikap, "Sangat baik");
  assert.equal(hasil.catatan.catatanPerkembangan, "Sudah lancar perkalian.");
});

test("nilai 0 dan 100 diterima sedangkan di luar rentang ditolak", async () => {
  await bersihkan();
  const guru = await buatGuru("Nilai");
  const murid = await buatMurid("Nilai");

  // Kedua ujung rentangnya sah.
  for (const nilai of [0, 100]) {
    const hasil = await createCatatanPerkembangan(guru.id, {
      muridId: murid.id,
      tanggal: "2026-03-02",
      nilai,
      sikap: "Baik",
      catatanPerkembangan: "",
    });
    assert.equal(hasil.status, "tersimpan");
    assert.equal(hasil.catatan.nilai, nilai);
  }

  const sebelum = (
    await pool.query(
      "SELECT count(*)::int AS jumlah FROM student_progress WHERE student_id = $1",
      [murid.id],
    )
  ).rows[0].jumlah;

  // Validator API (`z.number().min(0).max(100)`) menjaga pintu HTTP, tetapi
  // layanan ini juga dijaga batasan basis data (`student_progress_nilai_rentang`)
  // supaya jalur lain — impor, perbaikan manual, atau pemanggil baru — tidak
  // bisa menyisipkan nilai di luar rentang.
  for (const nilai of [-1, 101, 100.5]) {
    await assert.rejects(
      () =>
        createCatatanPerkembangan(guru.id, {
          muridId: murid.id,
          tanggal: "2026-03-03",
          nilai,
          sikap: "Baik",
          catatanPerkembangan: "",
        }),
      (error) => {
        assert.equal(
          kodeSql(error),
          "23514",
          `nilai ${nilai} ditolak basis data`,
        );
        return true;
      },
    );
  }

  const sesudah = (
    await pool.query(
      "SELECT count(*)::int AS jumlah FROM student_progress WHERE student_id = $1",
      [murid.id],
    )
  ).rows[0].jumlah;
  assert.equal(sesudah, sebelum, "penolakan tidak menyisakan baris");
});

test("murid yang tidak ada dijawab tanpa menulis baris", async () => {
  await bersihkan();
  const guru = await buatGuru("Murid Hantu");

  const hasil = await createCatatanPerkembangan(guru.id, {
    muridId: randomUUID(),
    tanggal: "2026-03-02",
    nilai: 80,
    sikap: "Baik",
    catatanPerkembangan: "",
  });

  // Jalur HTTP menerjemahkan ini jadi 404; layanannya tidak boleh melempar
  // galat kunci asing yang membingungkan.
  assert.deepEqual(hasil, { status: "murid_tidak_ada" });
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM student_progress WHERE guru_id = $1",
    [guru.id],
  );
  assert.equal(rows[0].jumlah, 0);
});

test("perubahan sebagian hanya menyentuh kolom yang dikirim", async () => {
  await bersihkan();
  const guru = await buatGuru("Ubah");
  const murid = await buatMurid("Ubah");
  const id = await tulisLangsung(murid.id, guru.id, {
    nilai: 70,
    sikap: "Cukup",
    catatan: "Perlu latihan soal cerita.",
    tanggal: "2026-03-02",
  });

  const diubah = await updateCatatanPerkembangan(guru.id, id, { nilai: 95 });

  assert.ok(diubah);
  assert.equal(diubah.nilai, 95);
  // Kolom yang tidak dikirim dibiarkan seperti semula.
  assert.equal(diubah.tanggal, "2026-03-02");
  assert.equal(diubah.sikap, "Cukup");
  assert.equal(diubah.catatanPerkembangan, "Perlu latihan soal cerita.");
  assert.equal(diubah.muridId, murid.id);
});

test("catatan guru lain tidak bisa diubah atau dihapus", async () => {
  await bersihkan();
  const penulis = await buatGuru("Penulis Asli");
  const guruLain = await buatGuru("Guru Lain");
  const murid = await buatMurid("Milik");
  const id = await tulisLangsung(murid.id, penulis.id, { nilai: 70 });

  // Dijawab `null` / `false` — sama seperti catatan yang tidak ada — supaya
  // catatan guru lain tidak bisa ditimpa diam-diam.
  assert.equal(
    await updateCatatanPerkembangan(guruLain.id, id, { nilai: 100 }),
    null,
  );
  assert.equal(await hapusCatatanPerkembangan(guruLain.id, id), false);

  const masihAda = await getCatatanPerkembangan(id);
  assert.equal(masihAda?.nilai, 70);
  assert.equal(masihAda?.guruId, penulis.id);

  // Penulisnya sendiri tetap boleh.
  assert.equal(await hapusCatatanPerkembangan(penulis.id, id), true);
  assert.equal(await getCatatanPerkembangan(id), null);
});

test("daftar menyaring per anak, rentang tanggal, dan kata kunci", async () => {
  await bersihkan();
  const guru = await buatGuru("Saring");
  const muridA = await buatMurid("Saring A");
  const muridB = await buatMurid("Saring B");

  await tulisLangsung(muridA.id, guru.id, {
    nilai: 70,
    tanggal: "2026-03-02",
    catatan: "Latihan pecahan.",
  });
  await tulisLangsung(muridA.id, guru.id, {
    nilai: 90,
    tanggal: "2026-03-09",
    catatan: "Naik 100% dari awal.",
  });
  await tulisLangsung(muridB.id, guru.id, {
    nilai: 60,
    tanggal: "2026-03-03",
    catatan: "Perlu pengulangan.",
  });

  // Per anak, terbaru lebih dulu.
  const anakA = await listCatatanPerkembangan(filter({ muridId: muridA.id }));
  assert.equal(anakA.data.length, 2);
  assert.equal(anakA.data[0].tanggal, "2026-03-09");
  assert.equal(anakA.data[0].nilai, 90);
  assert.equal(anakA.meta.total, 2);
  assert.equal(anakA.meta.hasMore, false);

  // Rentang tanggal.
  const setelah = await listCatatanPerkembangan(
    filter({ muridId: muridA.id, dari: "2026-03-05" }),
  );
  assert.equal(setelah.data.length, 1);
  assert.equal(setelah.data[0].tanggal, "2026-03-09");

  // Kata kunci menyentuh nama anak dan isi catatannya.
  assert.equal(
    (await listCatatanPerkembangan(filter({ cari: `${PENANDA} Saring B` })))
      .data.length,
    1,
  );
  assert.equal(
    (
      await listCatatanPerkembangan(
        filter({ muridId: muridA.id, cari: "pecahan" }),
      )
    ).data.length,
    1,
  );

  // `%` dan `_` dianggap huruf biasa, bukan pola pencarian. Tanpa pelolosan,
  // `%` dan `_` masing-masing akan mencocokkan kedua catatan anak itu.
  assert.equal(
    (await listCatatanPerkembangan(filter({ muridId: muridA.id, cari: "%" })))
      .data.length,
    1,
    "tanda persen cocok sebagai huruf biasa",
  );
  assert.equal(
    (await listCatatanPerkembangan(filter({ muridId: muridA.id, cari: "_" })))
      .data.length,
    0,
    "garis bawah tidak mencocokkan apa pun",
  );
  // Tanpa tanda khusus, pencarian tetap menemukan isinya.
  const persen = await listCatatanPerkembangan(
    filter({ muridId: muridA.id, cari: "100%" }),
  );
  assert.equal(persen.data.length, 1);
  assert.equal(persen.data[0].nilai, 90);

  // Paginasi: `hasMore` menandai masih ada halaman berikutnya, sedangkan
  // `total` menghitung seluruh baris yang cocok, bukan hanya halaman ini.
  const halaman = await listCatatanPerkembangan(
    filter({ muridId: muridA.id, limit: 1 }),
  );
  assert.equal(halaman.data.length, 1);
  assert.equal(halaman.meta.hasMore, true);
  assert.equal(halaman.meta.total, 2);
});

test("catatan terbaru per anak memilih tanggal terakhir lalu yang paling akhir dibuat", async () => {
  await bersihkan();
  const guru = await buatGuru("Terbaru");
  const muridA = await buatMurid("Terbaru A");
  const muridB = await buatMurid("Terbaru B");
  const muridKosong = await buatMurid("Terbaru Kosong");

  await tulisLangsung(muridA.id, guru.id, {
    nilai: 60,
    tanggal: "2026-03-02",
    dibuat: "2026-03-02T01:00:00Z",
  });
  // Dua catatan di hari terakhir; yang paling akhir dibuat yang dipakai.
  await tulisLangsung(muridA.id, guru.id, {
    nilai: 75,
    tanggal: "2026-03-09",
    dibuat: "2026-03-09T02:00:00Z",
  });
  await tulisLangsung(muridA.id, guru.id, {
    nilai: 95,
    tanggal: "2026-03-09",
    dibuat: "2026-03-09T03:00:00Z",
  });
  await tulisLangsung(muridB.id, guru.id, {
    nilai: 88,
    tanggal: "2026-02-01",
    dibuat: "2026-02-01T01:00:00Z",
  });

  const terbaru = await listCatatanTerbaruPerMurid();
  const nilaiPerMurid = new Map(
    terbaru.map((baris) => [baris.muridId, baris.nilai]),
  );

  assert.equal(nilaiPerMurid.get(muridA.id), 95);
  assert.equal(nilaiPerMurid.get(muridB.id), 88);
  // Anak yang belum pernah dicatat tidak muncul sebagai baris kosong, dan tiap
  // anak hanya muncul sekali walau punya beberapa catatan.
  assert.equal(nilaiPerMurid.has(muridKosong.id), false);
  assert.equal(
    terbaru.filter((baris) => baris.muridId === muridA.id).length,
    1,
  );
});

test("ringkasan menggabungkan catatan dan kehadiran per anak", async () => {
  await bersihkan();
  const guru = await buatGuru("Ringkasan");
  const kelasId = await buatKelas();
  const muridA = await buatMurid("Ringkasan A");
  const muridB = await buatMurid("Ringkasan B");
  const muridC = await buatMurid("Ringkasan C");

  await tulisLangsung(muridA.id, guru.id, {
    nilai: 70,
    sikap: "Cukup",
    tanggal: "2026-03-02",
  });
  await tulisLangsung(muridA.id, guru.id, {
    nilai: 91,
    sikap: "Sangat baik",
    tanggal: "2026-03-09",
  });
  // Anak kedua belum punya catatan, tetapi hadir di dua sesi (satu tidak hadir).
  await tulisKehadiran({
    guruId: guru.id,
    muridId: muridB.id,
    kelasId,
    tanggal: "2026-03-03",
  });
  await tulisKehadiran({
    guruId: guru.id,
    muridId: muridB.id,
    kelasId,
    tanggal: "2026-03-10",
    hadir: false,
  });

  const { data, meta } = await listRingkasanPerkembangan(
    filter({ cari: `${PENANDA} Ringkasan` }),
  );
  const perMurid = new Map(data.map((baris) => [baris.muridId, baris]));

  const barisA = perMurid.get(muridA.id);
  assert.equal(barisA.jumlahCatatan, 2);
  assert.equal(barisA.rataNilai, 80.5);
  assert.equal(barisA.nilaiTerakhir, 91);
  assert.equal(barisA.sikapTerakhir, "Sangat baik");
  assert.equal(barisA.tanggalCatatanTerakhir, "2026-03-09");

  // Anak tanpa catatan tetap muncul selama ada kehadirannya, dengan angka nol
  // yang jelas — laporan ke orang tua tidak boleh terlihat kosong.
  const barisB = perMurid.get(muridB.id);
  assert.equal(barisB.jumlahCatatan, 0);
  assert.equal(barisB.rataNilai, 0);
  assert.equal(barisB.nilaiTerakhir, null);
  assert.equal(barisB.sikapTerakhir, null);
  assert.equal(barisB.jumlahPertemuan, 2);
  assert.equal(barisB.jumlahHadir, 1);

  // Anak yang tidak punya catatan maupun kehadiran tidak muncul.
  assert.equal(perMurid.has(muridC.id), false);

  assert.equal(meta.total, 2);
  assert.equal(meta.muridPunyaCatatan, 1);
  assert.equal(meta.totalCatatan, 2);

  // Penyaring tanggal berlaku untuk catatan **dan** kehadiran sekaligus.
  const periode = await listRingkasanPerkembangan(
    filter({ cari: `${PENANDA} Ringkasan`, dari: "2026-03-05" }),
  );
  const periodePerMurid = new Map(
    periode.data.map((baris) => [baris.muridId, baris]),
  );
  assert.equal(periodePerMurid.get(muridA.id).jumlahCatatan, 1);
  assert.equal(periodePerMurid.get(muridA.id).rataNilai, 91);
  assert.equal(periodePerMurid.get(muridB.id).jumlahPertemuan, 1);
  assert.equal(periodePerMurid.get(muridB.id).jumlahHadir, 0);
});

test("riwayat satu anak mengemas anak, ringkasan, catatan, dan kehadiran", async () => {
  await bersihkan();
  const guru = await buatGuru("Riwayat");
  const kelasId = await buatKelas();
  const murid = await buatMurid("Riwayat");

  await tulisLangsung(murid.id, guru.id, { nilai: 80, tanggal: "2026-03-02" });
  await tulisKehadiran({
    guruId: guru.id,
    muridId: murid.id,
    kelasId,
    tanggal: "2026-03-03",
  });

  const riwayat = await getRiwayatPerkembangan(murid.id, 50, 0);
  assert.equal(riwayat.murid.id, murid.id);
  assert.equal(riwayat.ringkasan.jumlahCatatan, 1);
  assert.equal(riwayat.ringkasan.rataNilai, 80);
  assert.equal(riwayat.catatan.data.length, 1);
  assert.equal(riwayat.catatan.data[0].muridNama, murid.nama);
  assert.equal(riwayat.kehadiran.data.length, 1);
  assert.equal(riwayat.kehadiran.data[0].hadir, true);

  // Anak yang tidak ada dijawab `null` — halaman menerjemahkannya jadi 404.
  assert.equal(await getRiwayatPerkembangan(randomUUID(), 50, 0), null);
});

test("riwayat banyak anak memakai satu permintaan dan aman untuk daftar kosong", async () => {
  await bersihkan();
  const guru = await buatGuru("Portal");
  const muridA = await buatMurid("Portal A");
  const muridB = await buatMurid("Portal B");

  await tulisLangsung(muridA.id, guru.id, { nilai: 70, tanggal: "2026-03-02" });
  await tulisLangsung(muridB.id, guru.id, { nilai: 90, tanggal: "2026-03-09" });

  assert.deepEqual(await listCatatanPerkembanganAnak([]), []);

  const semua = await listCatatanPerkembanganAnak([muridA.id, muridB.id]);
  assert.deepEqual(
    semua.map((baris) => baris.nilai),
    [90, 70],
    "terbaru lebih dulu lintas anak",
  );
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});
