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
