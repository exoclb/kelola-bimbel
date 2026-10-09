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

/**
 * Seeder cabang dan kelas menghasilkan keadaan yang konsisten dengan data
 * contoh: jumlah kelas per cabang di ringkasan sama dengan jumlah kelas contoh
 * yang menunjuk cabang itu, dan angkanya ikut turun saat kelasnya dihapus.
 */
test("hasil seeder cabang dan kelas konsisten dengan data contoh", async () => {
  const { seedCabang } = await import("../scripts/lib/seed-cabang.mjs");
  const { seedKelas } = await import("../scripts/lib/seed-kelas.mjs");
  const { getDaftarCabang } = await import("../src/lib/mock-cabang.ts");
  const { getDaftarKelas } = await import("../src/lib/mock-kelas.ts");

  await bersihkan();
  const cabangContoh = getDaftarCabang();
  const kelasContoh = getDaftarKelas();
  await seedCabang(pool, cabangContoh);
  const hasil = await seedKelas(pool, kelasContoh);
  assert.equal(hasil.jumlah, kelasContoh.length);

  const daftar = await ringkasanPerCabang();
  for (const cabang of cabangContoh) {
    const harapan = kelasContoh.filter(
      (kelas) => kelas.cabang === cabang.nama,
    ).length;
    const baris = daftar.find((satu) => satu.nama === cabang.nama);
    assert.equal(baris.jumlahKelas, harapan, `kelas ${cabang.nama}`);
    assert.equal(
      baris.statusAktif,
      cabang.statusAktif,
      `status ${cabang.nama}`,
    );
  }

  // Menghapus satu kelas contoh menurunkan angka cabangnya.
  const korban = kelasContoh[0];
  const sebelum = (await jumlahKelasPerCabang())[korban.cabang];
  await pool.query("DELETE FROM classes WHERE nama_kelas = $1", [
    korban.namaKelas,
  ]);
  assert.equal((await jumlahKelasPerCabang())[korban.cabang], sebelum - 1);

  await pool.query("DELETE FROM classes WHERE nama_kelas = ANY($1)", [
    kelasContoh.map((kelas) => kelas.namaKelas),
  ]);
});

/**
 * Murid dihitung sekali walau aktif di dua kelas cabang yang sama, penempatan
 * yang sudah selesai tidak dihitung, dan jurnal dihitung per sesi.
 */
test("ringkasanPerCabang menghitung murid unik yang masih aktif", async () => {
  await bersihkan();

  const cabang = `${PENANDA} Unik`;
  await pool.query(
    "INSERT INTO cabang (nama, alamat, kontak) VALUES ($1, 'Jl. Uji No. 4', '0800-4')",
    [cabang],
  );
  await pool.query(
    `INSERT INTO "user" (id, name, email)
     VALUES ($1, 'Guru Ringkasan', 'guru-ringkasan-uji@example.test')
     ON CONFLICT (id) DO NOTHING`,
    [GURU],
  );

  const { rows: kelas } = await pool.query(
    "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2), ($3, $4) RETURNING id",
    [`${PENANDA} Unik A`, cabang, `${PENANDA} Unik B`, cabang],
  );
  const murid = async (nama) =>
    (
      await pool.query("INSERT INTO students (nama) VALUES ($1) RETURNING id", [
        nama,
      ])
    ).rows[0].id;
  const aktif = await murid(`${PENANDA} Murid Aktif`);
  const selesai = await murid(`${PENANDA} Murid Selesai`);

  // Satu murid aktif di dua kelas cabang yang sama.
  await pool.query(
    "INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai) VALUES ($1, $2, '2026-01-05'), ($1, $3, '2026-01-05')",
    [aktif, kelas[0].id, kelas[1].id],
  );
  // Penempatan lama yang sudah selesai tidak dihitung.
  await pool.query(
    "INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status) VALUES ($1, $2, '2025-01-05', 'selesai')",
    [selesai, kelas[0].id],
  );

  // Dua jurnal: satu di tiap kelas.
  for (const [urutan, barisKelas] of kelas.entries())
    await pool.query(
      `INSERT INTO teaching_journals (guru_id, class_id, tanggal, materi, jam_mengajar)
       VALUES ($1, $2, $3, $4, 1.5)`,
      [GURU, barisKelas.id, `2026-01-0${urutan + 7}`, `Materi unik ${urutan}`],
    );

  const baris = (await ringkasanPerCabang()).find(
    (satu) => satu.nama === cabang,
  );
  assert.deepEqual(baris, {
    nama: cabang,
    statusAktif: true,
    jumlahKelas: 2,
    jumlahMurid: 1,
    jurnalTerisi: 2,
    belumAdaJurnal: 0,
  });

  await bersihkan();
});

test.after(async () => {
  await bersihkan();
  await pool.query('DELETE FROM "user" WHERE id = $1', [GURU]);
  await pool.end();
});
