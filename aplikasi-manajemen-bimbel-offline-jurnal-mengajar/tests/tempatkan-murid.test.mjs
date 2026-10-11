import test from "node:test";
import assert from "node:assert/strict";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";
import { Pool } from "pg";

const { tempatkanMurid, keluarkanMurid } =
  await import("../src/services/kelas.service.ts");
const { createMurid } = await import("../src/services/murid.service.ts");

const PENANDA = "Uji Tempatkan Murid";
const CABANG = `${PENANDA} Cabang`;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Hapus baris uji berkas ini; kelas dan muridnya pergi bersama penempatannya. */
async function bersihkan() {
  await pool.query("DELETE FROM classes WHERE nama_kelas LIKE $1", [
    `%${PENANDA}%`,
  ]);
  await pool.query("DELETE FROM students WHERE nama LIKE $1", [`%${PENANDA}%`]);
  await pool.query("DELETE FROM cabang WHERE nama LIKE $1", [`%${PENANDA}%`]);
}

/** Satu cabang (aktif atau nonaktif) beserta satu kelas di dalamnya. */
async function siapkanKelas(namaKelas, namaCabang, statusAktif) {
  await pool.query(
    `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
     VALUES ($1, 'Jl. Uji No. 2', '0800-2', $2)
     ON CONFLICT (lower(btrim(nama))) DO UPDATE SET status_aktif = EXCLUDED.status_aktif`,
    [namaCabang, statusAktif],
  );
  const { rows } = await pool.query(
    "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2) RETURNING id",
    [namaKelas, namaCabang],
  );
  return rows[0].id;
}

async function hitung(kelasId, muridId) {
  const { rows } = await pool.query(
    `SELECT status FROM student_enrollments
     WHERE class_id = $1 AND student_id = $2`,
    [kelasId, muridId],
  );
  return rows;
}

/**
 * Aturan "cabang harus siap dipakai" ditegakkan di layanan, bukan hanya di
 * layar: pemanggil API tidak boleh bisa menempatkan murid ke kelas yang
 * cabangnya sedang nonaktif, karena itulah satu-satunya tempat aturan ini bisa
 * dijamin. Kelasnya sendiri tidak dikunci — begitu cabangnya diaktifkan lagi,
 * penempatan langsung boleh.
 */
test("tempatkanMurid menolak kelas di cabang nonaktif", async () => {
  await bersihkan();
  const kelasNonaktif = await siapkanKelas(
    `${PENANDA} Kelas Mati`,
    `${PENANDA} Cabang Mati`,
    false,
  );
  const murid = await createMurid({
    nama: `${PENANDA} Anak`,
    tanggalLahir: "2014-03-02",
    statusAktif: true,
  });

  const ditolak = await tempatkanMurid(kelasNonaktif, murid.id, "2026-01-05");
  assert.equal(ditolak.status, "cabang_nonaktif");
  assert.equal(
    ditolak.pesan,
    `Kelas ${PENANDA} Kelas Mati berada di cabang ${PENANDA} Cabang Mati yang nonaktif, jadi belum bisa dipakai untuk penempatan baru. Aktifkan dulu cabangnya di halaman Cabang.`,
  );
  // Penolakannya benar-benar tidak menyisipkan baris.
  assert.deepEqual(await hitung(kelasNonaktif, murid.id), []);

  // Diaktifkan lagi: penempatan langsung diterima, tanpa langkah lain.
  await pool.query("UPDATE cabang SET status_aktif = true WHERE nama = $1", [
    `${PENANDA} Cabang Mati`,
  ]);
  const diterima = await tempatkanMurid(kelasNonaktif, murid.id, "2026-01-05");
  assert.deepEqual(diterima, { status: "tersimpan" });
  assert.deepEqual(await hitung(kelasNonaktif, murid.id), [
    { status: "aktif" },
  ]);
});

test("tempatkanMurid menyimpan di cabang aktif dan menolak yang sudah keluar", async () => {
  await bersihkan();
  const kelas = await siapkanKelas(`${PENANDA} Kelas Aktif`, CABANG, true);
  const murid = await createMurid({
    nama: `${PENANDA} Anak Aktif`,
    tanggalLahir: "2014-03-02",
    statusAktif: true,
  });

  assert.deepEqual(await tempatkanMurid(kelas, murid.id, "2026-01-05"), {
    status: "tersimpan",
  });
  // Penempatan kedua di kelas yang sama ditolak, bukan menambah baris.
  assert.deepEqual(await tempatkanMurid(kelas, murid.id, "2026-01-06"), {
    status: "sudah_terdaftar",
  });
  assert.deepEqual(await hitung(kelas, murid.id), [{ status: "aktif" }]);

  // Setelah keluar, pasangan yang sama boleh ditempatkan lagi.
  assert.equal(await keluarkanMurid(kelas, murid.id), true);
  assert.deepEqual(await tempatkanMurid(kelas, murid.id, "2026-02-01"), {
    status: "tersimpan",
  });
  assert.deepEqual(await hitung(kelas, murid.id), [
    { status: "selesai" },
    { status: "aktif" },
  ]);

  await bersihkan();
});
