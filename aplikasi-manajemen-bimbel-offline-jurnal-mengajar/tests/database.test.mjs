import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { root } from "../scripts/lib.mjs";

test("PostgreSQL migrations preserve rows on rerun and enforce auth constraints", async () => {
  const url = process.env.STARTER_TEST_DATABASE_URL;
  assert.ok(
    url && process.env.STARTER_TEST_RUN?.startsWith("starter-pg-test-"),
    "Run npm test to create an isolated database.",
  );
  const db = new Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  try {
    await db.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
      "one",
      "One",
      "one@example.com",
    ]);
    await db.query(
      "INSERT INTO session (id, token, expires_at, user_id) VALUES ($1, $2, $3, $4)",
      ["session-one", "token-one", new Date(Date.now() + 60000), "one"],
    );
    await db.query("INSERT INTO notes (title, user_id) VALUES ($1, $2)", [
      "Migration persistence",
      "one",
    ]);
    const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      (await db.query('SELECT count(*)::int AS count FROM "user"')).rows[0]
        .count,
      1,
    );
    const row = (
      await db.query(
        'SELECT email_verified, created_at FROM "user" WHERE id = $1',
        ["one"],
      )
    ).rows[0];
    assert.equal(row.email_verified, false);
    assert.ok(row.created_at instanceof Date);
    await assert.rejects(
      db.query('INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)', [
        "two",
        "Two",
        "one@example.com",
      ]),
      { code: "23505" },
    );
    await assert.rejects(
      db.query(
        "INSERT INTO session (id, token, expires_at, user_id) VALUES ($1, $2, $3, $4)",
        ["invalid", "invalid-token", new Date(), "missing"],
      ),
      { code: "23503" },
    );
    const note = (
      await db.query(
        "SELECT id, content, created_at FROM notes WHERE user_id = $1",
        ["one"],
      )
    ).rows[0];
    assert.match(note.id, /^[0-9a-f-]{36}$/);
    assert.equal(note.content, "");
    assert.ok(note.created_at instanceof Date);
    await assert.rejects(
      db.query("INSERT INTO notes (title, user_id) VALUES ($1, $2)", [
        "Orphan",
        "missing",
      ]),
      { code: "23503" },
    );
    await db.query('DELETE FROM "user" WHERE id = $1', ["one"]);
    assert.equal(
      (await db.query("SELECT count(*)::int AS count FROM notes")).rows[0]
        .count,
      0,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS count FROM session")).rows[0]
        .count,
      0,
    );
  } finally {
    await db.end();
  }
});

/**
 * Invarian skema jurnal mengajar (`drizzle/0003_jurnal.sql`,
 * `0004_jurnal_idempoten.sql`): jurnal tidak boleh dobel untuk guru + jadwal +
 * tanggal yang sama, kehadiran murid tidak boleh dobel di satu jurnal, dan
 * pilihan `on delete` tiap relasi harus benar.
 *
 * Datanya disiapkan saat tes pertama dijalankan (bukan di `before`), supaya
 * jumlah baris `user` yang diperiksa tes di atas tetap utuh.
 */
let dbJurnal;
let dataJurnal;

async function siapkanJurnal() {
  if (dataJurnal) return dataJurnal;
  dbJurnal = new Pool({
    connectionString: process.env.STARTER_TEST_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const guru = (
    await dbJurnal.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3) RETURNING id`,
      ["guru-jurnal-skema", "Guru Skema", "guru-skema@example.test"],
    )
  ).rows[0].id;
  const kelas = (
    await dbJurnal.query(
      "INSERT INTO classes (nama_kelas, cabang, guru_id) VALUES ($1, $2, $3) RETURNING id",
      ["Kelas Skema", "Cabang Uji", guru],
    )
  ).rows[0].id;
  const jadwal = async (hari) =>
    (
      await dbJurnal.query(
        "INSERT INTO schedules (class_id, guru_id, hari, jam_mulai, jam_selesai) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [kelas, guru, hari, "09:00", "10:30"],
      )
    ).rows[0].id;
  dataJurnal = {
    guru,
    kelas,
    jadwalA: await jadwal("Senin"),
    jadwalB: await jadwal("Rabu"),
    murid: (
      await dbJurnal.query(
        "INSERT INTO students (nama) VALUES ($1) RETURNING id",
        ["Murid Skema"],
      )
    ).rows[0].id,
  };
  return dataJurnal;
}

test.after(async () => {
  await dbJurnal?.end();
});

/** Menulis satu jurnal; dipakai berulang dengan jadwal/tanggal berbeda. */
async function tulisJurnal(scheduleId, tanggal, jam = 1.5) {
  const { guru, kelas } = await siapkanJurnal();
  return dbJurnal.query(
    `INSERT INTO teaching_journals (guru_id, class_id, schedule_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [guru, kelas, scheduleId, tanggal, "Materi uji", jam],
  );
}

/** Jalankan kueri yang memang harus ditolak, lalu kembalikan galatnya. */
async function ditolak(kueri, params) {
  try {
    await dbJurnal.query(kueri, params);
  } catch (galat) {
    return galat;
  }
  assert.fail("Kueri seharusnya ditolak database.");
}

test("jurnal tidak boleh dobel untuk guru + jadwal + tanggal yang sama", async () => {
  const { jadwalA, jadwalB, guru, kelas } = await siapkanJurnal();

  assert.ok((await tulisJurnal(jadwalA, "2026-10-05")).rows[0].id);
  // Jadwal lain pada tanggal yang sama tetap boleh.
  assert.ok((await tulisJurnal(jadwalB, "2026-10-05")).rows[0].id);
  // Jadwal yang sama pada tanggal lain juga boleh.
  assert.ok((await tulisJurnal(jadwalA, "2026-10-06")).rows[0].id);

  // Kirim ulang jurnal yang sama (dobel klik / ulang setelah koneksi putus)
  // ditolak database, bukan hanya oleh API.
  const galat = await ditolak(
    `INSERT INTO teaching_journals (guru_id, class_id, schedule_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [guru, kelas, jadwalA, "2026-10-05", "Materi uji", 1.5],
  );
  assert.equal(galat.code, "23505");
});

test("kehadiran murid tidak boleh dobel di satu jurnal", async () => {
  const { jadwalA, murid } = await siapkanJurnal();
  const jurnal = (await tulisJurnal(jadwalA, "2026-10-07")).rows[0].id;
  await dbJurnal.query(
    "INSERT INTO journal_attendances (journal_id, student_id, hadir) VALUES ($1, $2, $3)",
    [jurnal, murid, true],
  );

  const galat = await ditolak(
    "INSERT INTO journal_attendances (journal_id, student_id, hadir) VALUES ($1, $2, $3)",
    [jurnal, murid, false],
  );
  assert.equal(galat.code, "23505");
});

test("menghapus jurnal ikut menghapus kehadirannya", async () => {
  const { jadwalA, murid } = await siapkanJurnal();
  const jurnal = (await tulisJurnal(jadwalA, "2026-10-08")).rows[0].id;
  await dbJurnal.query(
    "INSERT INTO journal_attendances (journal_id, student_id, hadir) VALUES ($1, $2, $3)",
    [jurnal, murid, true],
  );

  await dbJurnal.query("DELETE FROM teaching_journals WHERE id = $1", [jurnal]);
  const sisa = await dbJurnal.query(
    "SELECT count(*)::int AS jumlah FROM journal_attendances WHERE journal_id = $1",
    [jurnal],
  );
  assert.equal(sisa.rows[0].jumlah, 0);
});

test("murid yang masih punya kehadiran tidak bisa dihapus", async () => {
  const { jadwalA, murid } = await siapkanJurnal();
  const jurnal = (await tulisJurnal(jadwalA, "2026-10-09")).rows[0].id;
  await dbJurnal.query(
    "INSERT INTO journal_attendances (journal_id, student_id, hadir) VALUES ($1, $2, $3)",
    [jurnal, murid, true],
  );

  const galat = await ditolak("DELETE FROM students WHERE id = $1", [murid]);
  assert.equal(galat.code, "23503");
});

test("jam mengajar dan status jurnal dibatasi tipe kolomnya", async () => {
  const { jadwalA, guru, kelas } = await siapkanJurnal();

  // numeric(4,2) hanya menampung sampai 99,99 jam.
  const terlaluBesar = await ditolak(
    `INSERT INTO teaching_journals (guru_id, class_id, schedule_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [guru, kelas, jadwalA, "2026-10-10", "Materi uji", 123.45],
  );
  assert.equal(terlaluBesar.code, "22003");

  const statusAneh = await ditolak(
    `INSERT INTO teaching_journals (guru_id, class_id, schedule_id, tanggal, materi, jam_mengajar, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [guru, kelas, jadwalA, "2026-10-11", "Materi uji", 1.5, "draft"],
  );
  assert.equal(statusAneh.code, "22P02");
});

/**
 * Invarian skema presensi sesi guru (`drizzle/0017_presensi_guru.sql`): satu
 * catatan per guru + jadwal + tanggal (idempoten), jadwal dan guru yang hilang
 * ikut membersihkan catatannya, sedangkan guru pengganti hanya dilepas (null).
 */
test("presensi sesi tidak boleh dobel untuk guru + jadwal + tanggal yang sama", async () => {
  const { guru, jadwalA, jadwalB } = await siapkanJurnal();
  const tulis = (scheduleId, tanggal, status = "hadir") =>
    dbJurnal.query(
      `INSERT INTO teacher_attendances (guru_id, schedule_id, tanggal, status)
       VALUES ($1, $2, $3, $4)`,
      [guru, scheduleId, tanggal, status],
    );

  await tulis(jadwalA, "2026-10-05");
  // Jadwal lain pada tanggal yang sama dan jadwal yang sama pada tanggal lain
  // tetap boleh punya catatan sendiri.
  await tulis(jadwalB, "2026-10-05", "izin");
  await tulis(jadwalA, "2026-10-06", "tidak_hadir");

  const galat = await ditolak(
    `INSERT INTO teacher_attendances (guru_id, schedule_id, tanggal, status)
     VALUES ($1, $2, $3, $4)`,
    [guru, jadwalA, "2026-10-05", "hadir"],
  );
  assert.equal(galat.code, "23505");

  const statusAneh = await ditolak(
    `INSERT INTO teacher_attendances (guru_id, schedule_id, tanggal, status)
     VALUES ($1, $2, $3, $4)`,
    [guru, jadwalA, "2026-10-07", "telat"],
  );
  assert.equal(statusAneh.code, "22P02");
});

test("menghapus jadwal ikut menghapus presensi sesinya", async () => {
  const { guru, jadwalB } = await siapkanJurnal();
  const jadwalSementara = (
    await dbJurnal.query(
      "INSERT INTO schedules (class_id, guru_id, hari, jam_mulai, jam_selesai) SELECT class_id, guru_id, $1, $2, $3 FROM schedules WHERE id = $4 RETURNING id",
      ["Kamis", "13:00", "14:00", jadwalB],
    )
  ).rows[0].id;
  await dbJurnal.query(
    `INSERT INTO teacher_attendances (guru_id, schedule_id, tanggal, status)
     VALUES ($1, $2, $3, $4)`,
    [guru, jadwalSementara, "2026-10-08", "hadir"],
  );

  await dbJurnal.query("DELETE FROM schedules WHERE id = $1", [
    jadwalSementara,
  ]);
  const sisa = await dbJurnal.query(
    "SELECT count(*)::int AS jumlah FROM teacher_attendances WHERE schedule_id = $1",
    [jadwalSementara],
  );
  assert.equal(sisa.rows[0].jumlah, 0);
});

test("guru pengganti yang dihapus hanya dilepas, catatannya tetap ada", async () => {
  const { guru, jadwalA } = await siapkanJurnal();
  const pengganti = (
    await dbJurnal.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3) RETURNING id`,
      ["guru-pengganti-skema", "Guru Pengganti", "guru-pengganti@example.test"],
    )
  ).rows[0].id;

  await dbJurnal.query(
    `INSERT INTO teacher_attendances (guru_id, schedule_id, tanggal, status, guru_pengganti_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [guru, jadwalA, "2026-10-09", "digantikan", pengganti],
  );
  await dbJurnal.query('DELETE FROM "user" WHERE id = $1', [pengganti]);

  const baris = (
    await dbJurnal.query(
      "SELECT guru_pengganti_id, status FROM teacher_attendances WHERE guru_id = $1 AND schedule_id = $2 AND tanggal = $3",
      [guru, jadwalA, "2026-10-09"],
    )
  ).rows[0];
  assert.equal(baris.guru_pengganti_id, null);
  assert.equal(baris.status, "digantikan");
});

/**
 * Invarian skema kelas, murid, penempatan, dan jadwal (`drizzle/0003_jurnal.sql`
 * dan `0014_penempatan_multi_kelas.sql`): jadwal tidak boleh dobel per kelas +
 * hari + jam mulai, penempatan aktif hanya satu per murid + kelas, dan pilihan
 * `on delete` tiap relasi harus benar.
 */
async function siapkanKelasMurid() {
  const { guru, kelas, murid } = await siapkanJurnal();
  return { guru, kelas, murid };
}

test("jadwal tidak boleh dobel untuk kelas + hari + jam mulai yang sama", async () => {
  const { guru, kelas } = await siapkanKelasMurid();
  const tulis = (hari, jamMulai, jamSelesai = "11:00") =>
    dbJurnal.query(
      "INSERT INTO schedules (class_id, guru_id, hari, jam_mulai, jam_selesai) VALUES ($1, $2, $3, $4, $5)",
      [kelas, guru, hari, jamMulai, jamSelesai],
    );

  await tulis("Jumat", "10:00");
  // Jam mulai berbeda pada hari yang sama tetap boleh.
  await tulis("Jumat", "13:00");

  const galat = await ditolak(
    "INSERT INTO schedules (class_id, guru_id, hari, jam_mulai, jam_selesai) VALUES ($1, $2, $3, $4, $5)",
    [kelas, guru, "Jumat", "10:00", "11:30"],
  );
  assert.equal(galat.code, "23505");
});

test("penempatan aktif hanya satu per murid + kelas", async () => {
  const { kelas, murid } = await siapkanKelasMurid();
  const tempatkan = (status, tanggalMulai) =>
    dbJurnal.query(
      "INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status) VALUES ($1, $2, $3, $4)",
      [murid, kelas, tanggalMulai, status],
    );

  await tempatkan("aktif", "2026-01-05");
  const galat = await ditolak(
    "INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status) VALUES ($1, $2, $3, $4)",
    [murid, kelas, "2026-02-05", "aktif"],
  );
  assert.equal(galat.code, "23505");

  // Setelah penempatan lama ditandai selesai, penempatan baru boleh dibuat.
  await dbJurnal.query(
    "UPDATE student_enrollments SET status = 'selesai' WHERE student_id = $1 AND class_id = $2",
    [murid, kelas],
  );
  const baru = await tempatkan("aktif", "2026-03-05");
  assert.equal(baru.rowCount, 1);
});

test("menghapus kelas ikut menghapus jadwalnya, tetapi tertahan kalau ada jurnal", async () => {
  const { guru, kelas } = await siapkanKelasMurid();

  // Kelas tanpa jurnal: jadwalnya ikut terhapus saat kelasnya dihapus.
  const kelasKosong = (
    await dbJurnal.query(
      "INSERT INTO classes (nama_kelas, cabang, guru_id) VALUES ($1, $2, $3) RETURNING id",
      ["Kelas Tanpa Jurnal", "Cabang Uji", guru],
    )
  ).rows[0].id;
  await dbJurnal.query(
    "INSERT INTO schedules (class_id, guru_id, hari, jam_mulai, jam_selesai) VALUES ($1, $2, $3, $4, $5)",
    [kelasKosong, guru, "Sabtu", "09:00", "10:00"],
  );

  await dbJurnal.query("DELETE FROM classes WHERE id = $1", [kelasKosong]);
  const sisa = await dbJurnal.query(
    "SELECT count(*)::int AS jumlah FROM schedules WHERE class_id = $1",
    [kelasKosong],
  );
  assert.equal(sisa.rows[0].jumlah, 0);

  // Kelas yang sudah punya jurnal tidak boleh dihapus (jurnalnya menyimpan jam
  // yang dipakai menghitung gaji).
  const galat = await ditolak("DELETE FROM classes WHERE id = $1", [kelas]);
  assert.equal(galat.code, "23503");
});

test("menghapus murid ikut menghapus penempatannya", async () => {
  const { kelas } = await siapkanKelasMurid();
  const muridBaru = (
    await dbJurnal.query(
      "INSERT INTO students (nama) VALUES ($1) RETURNING id",
      ["Murid Tanpa Jurnal"],
    )
  ).rows[0].id;
  await dbJurnal.query(
    "INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status) VALUES ($1, $2, $3, $4)",
    [muridBaru, kelas, "2026-04-05", "aktif"],
  );

  await dbJurnal.query("DELETE FROM students WHERE id = $1", [muridBaru]);
  const sisa = await dbJurnal.query(
    "SELECT count(*)::int AS jumlah FROM student_enrollments WHERE student_id = $1",
    [muridBaru],
  );
  assert.equal(sisa.rows[0].jumlah, 0);
});

test("guru yang dihapus meninggalkan kelasnya tanpa pengampu", async () => {
  const guruSementara = (
    await dbJurnal.query(
      `INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3) RETURNING id`,
      ["guru-sementara-kelas", "Guru Sementara", "guru-sementara@example.test"],
    )
  ).rows[0].id;
  const kelasSementara = (
    await dbJurnal.query(
      "INSERT INTO classes (nama_kelas, cabang, guru_id) VALUES ($1, $2, $3) RETURNING id",
      ["Kelas Guru Sementara", "Cabang Uji", guruSementara],
    )
  ).rows[0].id;

  await dbJurnal.query('DELETE FROM "user" WHERE id = $1', [guruSementara]);
  const baris = (
    await dbJurnal.query("SELECT guru_id FROM classes WHERE id = $1", [
      kelasSementara,
    ])
  ).rows[0];
  assert.equal(baris.guru_id, null);
});

/**
 * Invarian skema catatan evaluasi (`drizzle/0010_catatan_perkembangan.sql` dan
 * `0020_catatan_evaluasi_nilai_rentang.sql`): nilai anak selalu 0–100 (dijaga
 * CHECK di database), satu anak boleh punya beberapa catatan pada hari yang
 * sama, dan menghapus anak atau guru ikut menghapus catatannya.
 */
test("nilai catatan evaluasi dibatasi 0 sampai 100 oleh database", async () => {
  const { guru, murid } = await siapkanJurnal();
  const tulis = (nilai) =>
    dbJurnal.query(
      "INSERT INTO student_progress (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan) VALUES ($1, $2, $3, $4, $5, $6)",
      [murid, guru, "2026-05-05", nilai, "Baik", "Catatan uji"],
    );

  await tulis(0);
  await tulis(100);
  // Dua catatan pada hari yang sama memang boleh.
  await tulis(85);

  const terlaluTinggi = await ditolak(
    "INSERT INTO student_progress (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan) VALUES ($1, $2, $3, $4, $5, $6)",
    [murid, guru, "2026-05-05", 120, "Baik", "Catatan uji"],
  );
  assert.equal(terlaluTinggi.code, "23514");

  const negatif = await ditolak(
    "INSERT INTO student_progress (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan) VALUES ($1, $2, $3, $4, $5, $6)",
    [murid, guru, "2026-05-05", -1, "Baik", "Catatan uji"],
  );
  assert.equal(negatif.code, "23514");
});

test("menghapus anak ikut menghapus catatan evaluasinya", async () => {
  const { guru } = await siapkanJurnal();
  const muridBaru = (
    await dbJurnal.query(
      "INSERT INTO students (nama) VALUES ($1) RETURNING id",
      ["Murid Tanpa Catatan"],
    )
  ).rows[0].id;
  await dbJurnal.query(
    "INSERT INTO student_progress (student_id, guru_id, tanggal, nilai, sikap, catatan_perkembangan) VALUES ($1, $2, $3, $4, $5, $6)",
    [muridBaru, guru, "2026-06-06", 75, "Cukup", "Catatan uji"],
  );

  await dbJurnal.query("DELETE FROM students WHERE id = $1", [muridBaru]);
  const sisa = await dbJurnal.query(
    "SELECT count(*)::int AS jumlah FROM student_progress WHERE student_id = $1",
    [muridBaru],
  );
  assert.equal(sisa.rows[0].jumlah, 0);
});

/**
 * Invarian skema tarif honor (`drizzle/0006_tarif_gaji.sql` dan
 * `0021_tarif_honor_tidak_negatif.sql`): satu tarif per tanggal berlaku dan
 * tarifnya tidak boleh negatif, supaya rekap gaji tidak pernah menghitung
 * angka minus.
 */
test("tarif honor satu per tanggal dan tidak boleh negatif", async () => {
  const tulis = (tarif, berlakuSejak) =>
    dbJurnal.query(
      "INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak) VALUES ($1, $2, $3)",
      [tarif, "per jam", berlakuSejak],
    );

  await tulis(50000, "2099-01-01");
  const kembar = await ditolak(
    "INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak) VALUES ($1, $2, $3)",
    [60000, "per jam", "2099-01-01"],
  );
  assert.equal(kembar.code, "23505");

  const negatif = await ditolak(
    "INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak) VALUES ($1, $2, $3)",
    [-1, "per jam", "2099-02-01"],
  );
  assert.equal(negatif.code, "23514");

  // Tarif 0 masih boleh (mis. kelas sukarela), yang ditolak hanya minus.
  const nol = await tulis(0, "2099-03-01");
  assert.equal(nol.rowCount, 1);
});

/**
 * Invarian skema honor terhitung (`drizzle/0007_rekap_gaji.sql` dan
 * `0022_honor_terhitung_invarian.sql`): satu catatan per guru per bulan,
 * periodenya berbentuk `YYYY-MM`, angkanya tidak negatif, dan status "dibayar"
 * selalu punya tanggal bayar.
 */
test("catatan honor terhitung dijaga periode, angka, dan tanggal bayarnya", async () => {
  const { guru } = await siapkanJurnal();
  const tulis = (periode, status = "belum_dibayar", tanggalDibayar = null) =>
    dbJurnal.query(
      "INSERT INTO salary_recaps (guru_id, periode_bulan, total_jam, tarif_per_jam, total_gaji, status_pembayaran, tanggal_dibayar) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [guru, periode, 10, 50000, 500000, status, tanggalDibayar],
    );

  await tulis("2099-01");
  const kembar = await ditolak(
    "INSERT INTO salary_recaps (guru_id, periode_bulan, total_jam, tarif_per_jam, total_gaji, status_pembayaran, tanggal_dibayar) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [guru, "2099-01", 10, 50000, 500000, "belum_dibayar", null],
  );
  assert.equal(kembar.code, "23505");

  const periodeAneh = await ditolak(
    "INSERT INTO salary_recaps (guru_id, periode_bulan, total_jam, tarif_per_jam, total_gaji, status_pembayaran, tanggal_dibayar) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [guru, "2099-13", 10, 50000, 500000, "belum_dibayar", null],
  );
  assert.equal(periodeAneh.code, "23514");

  const negatif = await ditolak(
    "INSERT INTO salary_recaps (guru_id, periode_bulan, total_jam, tarif_per_jam, total_gaji, status_pembayaran, tanggal_dibayar) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [guru, "2099-02", -1, 50000, -50000, "belum_dibayar", null],
  );
  assert.equal(negatif.code, "23514");

  const dibayarTanpaTanggal = await ditolak(
    "INSERT INTO salary_recaps (guru_id, periode_bulan, total_jam, tarif_per_jam, total_gaji, status_pembayaran, tanggal_dibayar) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [guru, "2099-03", 10, 50000, 500000, "dibayar", null],
  );
  assert.equal(dibayarTanpaTanggal.code, "23514");

  const dibayarDenganTanggal = await tulis("2099-04", "dibayar", "2099-05-01");
  assert.equal(dibayarDenganTanggal.rowCount, 1);
});

/**
 * Invarian skema tagihan SPP (`drizzle/0015_tagihan_murid.sql` dan
 * `0023_tagihan_spp_invarian.sql`): satu tagihan per murid per periode, nominal
 * tidak negatif, periode bulan 1–12, dan status "lunas" selalu sejalan dengan
 * tanggal bayarnya.
 */
test("tagihan SPP dijaga periode, nominal, dan tanggal bayarnya", async () => {
  const { murid } = await siapkanJurnal();
  const tulis = (
    bulan,
    tahun,
    nominal = 350000,
    status = "belum_lunas",
    tanggalBayar = null,
  ) =>
    dbJurnal.query(
      "INSERT INTO student_invoices (student_id, periode_bulan, periode_tahun, nominal, status, tanggal_bayar) VALUES ($1, $2, $3, $4, $5, $6)",
      [murid, bulan, tahun, nominal, status, tanggalBayar],
    );

  await tulis(1, 2099);
  const kembar = await ditolak(
    "INSERT INTO student_invoices (student_id, periode_bulan, periode_tahun, nominal, status, tanggal_bayar) VALUES ($1, $2, $3, $4, $5, $6)",
    [murid, 1, 2099, 350000, "belum_lunas", null],
  );
  assert.equal(kembar.code, "23505");

  const bulanAneh = await ditolak(
    "INSERT INTO student_invoices (student_id, periode_bulan, periode_tahun, nominal, status, tanggal_bayar) VALUES ($1, $2, $3, $4, $5, $6)",
    [murid, 13, 2099, 350000, "belum_lunas", null],
  );
  assert.equal(bulanAneh.code, "23514");

  const nominalNegatif = await ditolak(
    "INSERT INTO student_invoices (student_id, periode_bulan, periode_tahun, nominal, status, tanggal_bayar) VALUES ($1, $2, $3, $4, $5, $6)",
    [murid, 2, 2099, -1000, "belum_lunas", null],
  );
  assert.equal(nominalNegatif.code, "23514");

  // Lunas tanpa tanggal bayar ditolak, dan sebaliknya belum lunas tidak boleh
  // menyimpan tanggal bayar.
  const lunasTanpaTanggal = await ditolak(
    "INSERT INTO student_invoices (student_id, periode_bulan, periode_tahun, nominal, status, tanggal_bayar) VALUES ($1, $2, $3, $4, $5, $6)",
    [murid, 3, 2099, 350000, "lunas", null],
  );
  assert.equal(lunasTanpaTanggal.code, "23514");

  const belumLunasDenganTanggal = await ditolak(
    "INSERT INTO student_invoices (student_id, periode_bulan, periode_tahun, nominal, status, tanggal_bayar) VALUES ($1, $2, $3, $4, $5, $6)",
    [murid, 4, 2099, 350000, "belum_lunas", "2099-04-10"],
  );
  assert.equal(belumLunasDenganTanggal.code, "23514");

  const lunas = await tulis(5, 2099, 350000, "lunas", "2099-05-10");
  assert.equal(lunas.rowCount, 1);
});

/**
 * Invarian skema biaya operasional (`drizzle/0016_pengeluaran_operasional.sql`
 * dan `0024_biaya_operasional_invarian.sql`): nominal tidak negatif, tanggal
 * masuk akal, nama kategori terisi dan unik, serta kategori yang masih dipakai
 * tidak boleh dihapus.
 */
test("biaya operasional dijaga nominal, tanggal, dan kategorinya", async () => {
  const kategori = await dbJurnal.query(
    "INSERT INTO expense_categories (nama) VALUES ($1) RETURNING id",
    ["Sewa Uji Invarian"],
  );
  const kategoriId = kategori.rows[0].id;

  const kembar = await ditolak(
    "INSERT INTO expense_categories (nama) VALUES ($1)",
    ["Sewa Uji Invarian"],
  );
  assert.equal(kembar.code, "23505");

  const namaKosong = await ditolak(
    "INSERT INTO expense_categories (nama) VALUES ($1)",
    ["   "],
  );
  assert.equal(namaKosong.code, "23514");

  await dbJurnal.query(
    "INSERT INTO expenses (kategori_id, nominal, tanggal, catatan) VALUES ($1, $2, $3, $4)",
    [kategoriId, 150000, "2099-02-10", "Uji invarian"],
  );

  const nominalNegatif = await ditolak(
    "INSERT INTO expenses (kategori_id, nominal, tanggal) VALUES ($1, $2, $3)",
    [kategoriId, -1, "2099-02-10"],
  );
  assert.equal(nominalNegatif.code, "23514");

  const tanggalAneh = await ditolak(
    "INSERT INTO expenses (kategori_id, nominal, tanggal) VALUES ($1, $2, $3)",
    [kategoriId, 150000, "1999-12-31"],
  );
  assert.equal(tanggalAneh.code, "23514");

  // Kategori yang masih dipakai pengeluaran tidak boleh hilang: `restrict`.
  const dihapus = await ditolak(
    "DELETE FROM expense_categories WHERE id = $1",
    [kategoriId],
  );
  assert.equal(dihapus.code, "23503");
});

/**
 * Invarian profil bimbel (`drizzle/0012_profil_bimbel.sql` dan
 * `0025_profil_bimbel_invarian.sql`): hanya satu baris boleh ada, namanya
 * terisi, emailnya berbentuk alamat kalau diisi, dan logonya harus data URL
 * gambar.
 */
test("profil bimbel dijaga tunggal, namanya terisi, dan logonya data URL", async () => {
  await siapkanJurnal();

  const namaKosong = await ditolak(
    "INSERT INTO bimbel_profile (nama) VALUES ($1)",
    ["   "],
  );
  assert.equal(namaKosong.code, "23514");

  const emailAneh = await ditolak(
    "INSERT INTO bimbel_profile (nama, email) VALUES ($1, $2)",
    ["Bimbel Uji", "bukan-email"],
  );
  assert.equal(emailAneh.code, "23514");

  const logoAneh = await ditolak(
    "INSERT INTO bimbel_profile (nama, logo) VALUES ($1, $2)",
    ["Bimbel Uji", "https://contoh.test/logo.png"],
  );
  assert.equal(logoAneh.code, "23514");

  // Satu baris sah boleh masuk, baris kedua ditolak indeks unik tunggal.
  await dbJurnal.query("DELETE FROM bimbel_profile");
  const sah = await dbJurnal.query(
    "INSERT INTO bimbel_profile (nama, alamat, telepon, email, logo) VALUES ($1, $2, $3, $4, $5)",
    [
      "Bimbel Uji Invarian",
      "Jl. Uji 1",
      "08120000000",
      "halo@bimbel.test",
      "data:image/png;base64,iVBORw0KGgo=",
    ],
  );
  assert.equal(sah.rowCount, 1);

  const kedua = await ditolak("INSERT INTO bimbel_profile (nama) VALUES ($1)", [
    "Bimbel Lain",
  ]);
  assert.equal(kedua.code, "23505");
});

/**
 * Invarian notifikasi dan catatan backup (`drizzle/0013_notifikasi.sql`,
 * `0014_backup_runs.sql`, dan `0026_notifikasi_backup_invarian.sql`): tipe/pesan
 * notifikasi dan jenis preferensi harus terisi, preferensi unik per akun per
 * jenis, dan status backup harus sejalan dengan waktu selesainya.
 */
test("notifikasi dan backup dijaga isi, keunikan, dan statusnya", async () => {
  const { guru } = await siapkanJurnal();

  const tipeKosong = await ditolak(
    "INSERT INTO notifications (user_id, tipe, pesan) VALUES ($1, $2, $3)",
    [guru, "  ", "Pesan uji"],
  );
  assert.equal(tipeKosong.code, "23514");

  const pesanKosong = await ditolak(
    "INSERT INTO notifications (user_id, tipe, pesan) VALUES ($1, $2, $3)",
    [guru, "jurnal_baru", "   "],
  );
  assert.equal(pesanKosong.code, "23514");

  const notifikasi = await dbJurnal.query(
    "INSERT INTO notifications (user_id, tipe, pesan) VALUES ($1, $2, $3) RETURNING id",
    [guru, "jurnal_baru", "Jurnal baru masuk"],
  );
  assert.equal(notifikasi.rowCount, 1);

  const jenisKosong = await ditolak(
    "INSERT INTO notification_preferences (user_id, jenis_notifikasi) VALUES ($1, $2)",
    [guru, " "],
  );
  assert.equal(jenisKosong.code, "23514");

  await dbJurnal.query(
    "INSERT INTO notification_preferences (user_id, jenis_notifikasi, aktif) VALUES ($1, $2, $3)",
    [guru, "jurnal_baru", true],
  );
  const jenisKembar = await ditolak(
    "INSERT INTO notification_preferences (user_id, jenis_notifikasi, aktif) VALUES ($1, $2, $3)",
    [guru, "jurnal_baru", false],
  );
  assert.equal(jenisKembar.code, "23505");

  // Backup: status "berjalan" belum berselesai, status lain wajib berselesai.
  const berjalan = await dbJurnal.query(
    "INSERT INTO backup_runs (status) VALUES ($1) RETURNING id",
    ["berjalan"],
  );
  assert.equal(berjalan.rowCount, 1);

  const selesaiTanpaStatus = await ditolak(
    "UPDATE backup_runs SET status = $1 WHERE id = $2",
    ["sukses", berjalan.rows[0].id],
  );
  assert.equal(selesaiTanpaStatus.code, "23514");

  const berjalanTapiSelesai = await ditolak(
    "UPDATE backup_runs SET selesai = now() WHERE id = $1",
    [berjalan.rows[0].id],
  );
  assert.equal(berjalanTapiSelesai.code, "23514");

  const ukuranNegatif = await ditolak(
    "UPDATE backup_runs SET status = $1, selesai = now(), ukuran_byte = $2 WHERE id = $3",
    ["sukses", -1, berjalan.rows[0].id],
  );
  assert.equal(ukuranNegatif.code, "23514");

  const selesai = await dbJurnal.query(
    "UPDATE backup_runs SET status = $1, selesai = now(), ukuran_byte = $2 WHERE id = $3",
    ["sukses", 2048, berjalan.rows[0].id],
  );
  assert.equal(selesai.rowCount, 1);
});
