import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Pool } from "pg";

// Sama seperti `tests/cabang-service.test.mjs`: alias "@/..." diterjemahkan di
// sini, dan `npm test` mengaktifkan kondisi `react-server` supaya modul
// ber-"server-only" boleh diimpor.
const src = resolve(dirname(fileURLToPath(import.meta.url)), "../src");
const AKHIRAN = [".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(spesifier, konteks, lanjut) {
    let dasar;
    if (spesifier.startsWith("@/")) dasar = resolve(src, spesifier.slice(2));
    else if (
      spesifier.startsWith(".") &&
      konteks.parentURL?.startsWith("file:")
    )
      dasar = resolve(dirname(fileURLToPath(konteks.parentURL)), spesifier);
    if (dasar)
      for (const akhiran of AKHIRAN) {
        const berkas = dasar + akhiran;
        if (existsSync(berkas) && statSync(berkas).isFile())
          return lanjut(pathToFileURL(berkas).href, konteks);
      }
    return lanjut(spesifier, konteks);
  },
});

const { jumlahKelasPerCabang, jumlahkanRingkasanCabang, ringkasanPerCabang } =
  await import("../src/lib/ringkasan-cabang.ts");

const PENANDA = "Uji Ringkasan Cabang";
const GURU = "guru-ringkasan-uji";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Bersihkan seluruh data uji berkas ini, urut dari yang paling bergantung. */
async function bersihkan() {
  await pool.query(
    "DELETE FROM teaching_journals WHERE class_id IN (SELECT id FROM classes WHERE cabang LIKE $1)",
    [`%${PENANDA}%`],
  );
  await pool.query("DELETE FROM classes WHERE cabang LIKE $1", [
    `%${PENANDA}%`,
  ]);
  await pool.query("DELETE FROM students WHERE nama LIKE $1", [`%${PENANDA}%`]);
  await pool.query("DELETE FROM cabang WHERE nama LIKE $1", [`%${PENANDA}%`]);
}

/**
 * Ringkasan per cabang menghitung kelas, murid aktif, dan jurnal langsung dari
 * tabelnya: cabang berisi kelas dapat angka sebenarnya, dan cabang tanpa kelas
 * tetap muncul dengan angka nol.
 */
test("ringkasanPerCabang menghitung kelas, murid, dan jurnal dari basis data", async () => {
  await bersihkan();

  const berisi = `${PENANDA} Berisi`;
  const kosong = `${PENANDA} Kosong`;
  await pool.query(
    `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
     VALUES ($1, 'Jl. Uji No. 1', '0800-1', true),
            ($2, 'Jl. Uji No. 2', '0800-2', false)`,
    [berisi, kosong],
  );
  await pool.query(
    `INSERT INTO "user" (id, name, email) VALUES ($1, 'Guru Ringkasan', 'guru-ringkasan-uji@example.test')
     ON CONFLICT (id) DO NOTHING`,
    [GURU],
  );

  const { rows: kelas } = await pool.query(
    "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2), ($3, $4) RETURNING id",
    [`${PENANDA} Kelas A`, berisi, `${PENANDA} Kelas B`, berisi],
  );
  const { rows: murid } = await pool.query(
    "INSERT INTO students (nama) VALUES ($1) RETURNING id",
    [`${PENANDA} Murid`],
  );
  await pool.query(
    "INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai) VALUES ($1, $2, '2026-01-05')",
    [murid[0].id, kelas[0].id],
  );
  await pool.query(
    `INSERT INTO teaching_journals (guru_id, class_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, '2026-01-06', 'Materi ringkasan', 1.5)`,
    [GURU, kelas[0].id],
  );

  const daftar = await ringkasanPerCabang();
  const barisBerisi = daftar.find((baris) => baris.nama === berisi);
  const barisKosong = daftar.find((baris) => baris.nama === kosong);

  assert.deepEqual(barisBerisi, {
    nama: berisi,
    statusAktif: true,
    jumlahKelas: 2,
    jumlahMurid: 1,
    jurnalTerisi: 1,
    belumAdaJurnal: 1,
  });
  assert.deepEqual(barisKosong, {
    nama: kosong,
    statusAktif: false,
    jumlahKelas: 0,
    jumlahMurid: 0,
    jurnalTerisi: 0,
    belumAdaJurnal: 0,
  });

  // Urutannya sama dengan daftar cabang: menurut nama tak peka huruf besar-kecil.
  const kunci = daftar.map((baris) =>
    baris.nama.trim().toLocaleLowerCase("id"),
  );
  assert.deepEqual(
    kunci,
    [...kunci].sort((a, b) => a.localeCompare(b, "id")),
  );

  // Jumlah kelas per cabang memuat cabang yang berisi kelas, dan tidak
  // memunculkan cabang tanpa kelas (baris cabang lain di basis data uji ini
  // milik berkas tes lain, jadi hanya cabang uji ini yang diperiksa).
  const perCabang = await jumlahKelasPerCabang();
  assert.equal(perCabang[berisi], 2);
  assert.equal(perCabang[kosong], undefined);

  await bersihkan();
});

/**
 * Cabang yang belum punya kelas tetap tampil di ringkasan dengan angka nol,
 * dan tidak muncul di jumlah kelas per cabang.
 */
test("cabang tanpa kelas tampil dengan angka nol", async () => {
  await bersihkan();

  const kosong = `${PENANDA} Tanpa Kelas`;
  await pool.query(
    "INSERT INTO cabang (nama, alamat, kontak) VALUES ($1, 'Jl. Uji No. 3', '0800-3')",
    [kosong],
  );

  const baris = (await ringkasanPerCabang()).find(
    (satu) => satu.nama === kosong,
  );
  assert.deepEqual(baris, {
    nama: kosong,
    statusAktif: true,
    jumlahKelas: 0,
    jumlahMurid: 0,
    jurnalTerisi: 0,
    belumAdaJurnal: 0,
  });
  assert.equal((await jumlahKelasPerCabang())[kosong], undefined);

  await bersihkan();
});

/**
 * `jumlahkanRingkasanCabang` dipakai panel pantauan saat saringan cabangnya
 * kosong: seluruh baris dijumlahkan, dan daftar kosong menghasilkan nol.
 */
test("jumlahkanRingkasanCabang menjumlahkan seluruh cabang", () => {
  assert.deepEqual(
    jumlahkanRingkasanCabang([
      {
        nama: "Cabang A",
        statusAktif: true,
        jumlahKelas: 2,
        jumlahMurid: 3,
        jurnalTerisi: 5,
        belumAdaJurnal: 1,
      },
      {
        nama: "Cabang B",
        statusAktif: false,
        jumlahKelas: 1,
        jumlahMurid: 0,
        jurnalTerisi: 0,
        belumAdaJurnal: 1,
      },
    ]),
    { jumlahKelas: 3, jumlahMurid: 3, jurnalTerisi: 5, belumAdaJurnal: 2 },
  );

  assert.deepEqual(jumlahkanRingkasanCabang([]), {
    jumlahKelas: 0,
    jumlahMurid: 0,
    jurnalTerisi: 0,
    belumAdaJurnal: 0,
  });
});

test.after(async () => {
  await bersihkan();
  await pool.query('DELETE FROM "user" WHERE id = $1', [GURU]);
  await pool.end();
});
