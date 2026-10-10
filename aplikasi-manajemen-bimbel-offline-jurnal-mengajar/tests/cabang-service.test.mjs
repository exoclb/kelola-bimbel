import test from "node:test";
import assert from "node:assert/strict";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";
import { Pool } from "pg";

const {
  getCabang,
  getCabangByNama,
  listCabang,
  namaCabangDipakai,
  periksaCabangKelas,
  ringkasCabang,
  setStatusAktif,
  tambahCabang,
  ubahCabang,
} = await import("../src/services/cabang.service.ts");

const PENANDA = "Uji Layanan Cabang";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Hapus baris uji berkas ini; dipanggil sebelum dan sesudah tiap tes. */
async function bersihkan() {
  await pool.query("DELETE FROM cabang WHERE nama LIKE $1", [`%${PENANDA}%`]);
}

/**
 * Bentuk baris yang diterima komponen: layanan cabang mengembalikan persis
 * kolom yang dirender tampilan — id, nama, alamat, kontak, dan statusAktif.
 * Penanda waktu tabel tidak ikut, dan tidak ada kolom yang hilang.
 */
test("baris cabang memuat kolom yang dipakai komponen", async () => {
  await bersihkan();
  const nama = `${PENANDA} Bentuk`;
  const dibuat = await tambahCabang({
    nama,
    alamat: "Jl. Uji No. 7",
    kontak: "0800-7",
    statusAktif: true,
  });

  const sumber = [
    ["daftar", (await listCabang()).find((baris) => baris.nama === nama)],
    ["id", await getCabang(dibuat.cabang.id)],
    ["nama", await getCabangByNama(nama)],
  ];
  for (const [label, baris] of sumber) {
    assert.deepEqual(
      Object.keys(baris).sort(),
      ["alamat", "id", "kontak", "nama", "statusAktif"],
      `kolom dari ${label}`,
    );
    assert.equal(typeof baris.id, "string", `id dari ${label}`);
    assert.equal(typeof baris.nama, "string", `nama dari ${label}`);
    assert.equal(typeof baris.alamat, "string", `alamat dari ${label}`);
    assert.equal(typeof baris.kontak, "string", `kontak dari ${label}`);
    assert.equal(
      typeof baris.statusAktif,
      "boolean",
      `statusAktif dari ${label}`,
    );
    assert.equal("createdAt" in baris, false, `penanda waktu dari ${label}`);
  }
});

/**
 * `periksaCabangKelas` dipakai jalur simpan kelas: cabang yang belum terdaftar
 * dan yang nonaktif ditolak dengan kodenya masing-masing, sedangkan nama yang
 * cuma beda huruf besar-kecil atau spasi tepi dikembalikan sebagai nama
 * kanonik barisnya (itulah yang disimpan kolom `classes.cabang`).
 */
test("periksaCabangKelas menolak cabang tak terdaftar dan nonaktif", async () => {
  await bersihkan();
  const aktif = `${PENANDA} Periksa`;
  const nonaktif = `${PENANDA} Periksa Nonaktif`;
  await tambahCabang({
    nama: aktif,
    alamat: "Jl. Uji No. 8",
    kontak: "0800-8",
    statusAktif: true,
  });
  await tambahCabang({
    nama: nonaktif,
    alamat: "Jl. Uji No. 9",
    kontak: "0800-9",
    statusAktif: false,
  });

  const takAda = await periksaCabangKelas(`  ${PENANDA} Entah  `);
  assert.equal(takAda.ok, false);
  assert.equal(takAda.kode, "CABANG_TIDAK_ADA");
  assert.match(takAda.pesan, new RegExp(`${PENANDA} Entah`));

  const mati = await periksaCabangKelas(nonaktif);
  assert.equal(mati.ok, false);
  assert.equal(mati.kode, "CABANG_NONAKTIF");
  assert.match(mati.pesan, /nonaktif/);

  const sah = await periksaCabangKelas(`  ${aktif.toUpperCase()} `);
  assert.equal(sah.ok, true);
  assert.equal(sah.cabang.nama, aktif);
  assert.equal(sah.cabang.statusAktif, true);
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});

/**
 * `tambahCabang` menolak nama yang sudah dipakai tanpa membedakan huruf
 * besar-kecil atau spasi tepi, dan `namaCabangDipakai` yang dipakai formulir
 * memberi jawaban yang sama.
 */
test("tambahCabang menolak nama kembar tak peka huruf besar-kecil", async () => {
  await bersihkan();
  const nama = `${PENANDA} Satu`;

  assert.equal(await namaCabangDipakai(nama), false);
  const pertama = await tambahCabang({
    nama: `  ${nama}  `,
    alamat: "Jl. Uji No. 1",
    kontak: "0800-1",
    statusAktif: true,
  });
  assert.equal(pertama.ok, true);
  assert.equal(pertama.cabang.nama, nama);
  assert.equal(pertama.cabang.alamat, "Jl. Uji No. 1");

  assert.equal(await namaCabangDipakai(nama.toUpperCase()), true);
  assert.equal(await namaCabangDipakai(nama, pertama.cabang.id), false);

  const kembar = await tambahCabang({
    nama: `  ${nama.toUpperCase()} `,
    alamat: "Jl. Uji No. 2",
    kontak: "0800-2",
    statusAktif: true,
  });
  assert.equal(kembar.ok, false);
  assert.match(kembar.pesan, /sudah terdaftar/);

  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM cabang WHERE lower(btrim(nama)) = lower(btrim($1))",
    [nama],
  );
  assert.equal(rows[0].jumlah, 1);
});

/**
 * `ubahCabang` dan `setStatusAktif` mengembalikan baris terbaru, menolak id
 * yang tidak ada, dan aman dijalankan berulang dengan hasil yang sama.
 */
test("ubahCabang dan setStatusAktif idempoten dan menolak id asing", async () => {
  await bersihkan();
  const nama = `${PENANDA} Ubah`;
  const dibuat = await tambahCabang({
    nama,
    alamat: "Jl. Uji No. 3",
    kontak: "0800-3",
    statusAktif: true,
  });
  assert.equal(dibuat.ok, true);
  const id = dibuat.cabang.id;

  for (const ulangan of [1, 2]) {
    const ubah = await ubahCabang(id, {
      alamat: "Jl. Uji No. 4",
      kontak: "0800-4",
    });
    assert.equal(ubah.ok, true, `percobaan ke-${ulangan}`);
    assert.equal(ubah.cabang.alamat, "Jl. Uji No. 4");
    assert.equal(ubah.cabang.kontak, "0800-4");
  }

  // Ubah tanpa kolom yang benar-benar berubah tetap berhasil.
  const tanpaPerubahan = await ubahCabang(id, {
    alamat: "Jl. Uji No. 4",
  });
  assert.equal(tanpaPerubahan.ok, true);

  // Nama yang sudah dipakai cabang lain ditolak.
  const lain = await tambahCabang({
    nama: `${PENANDA} Lain`,
    alamat: "Jl. Uji No. 5",
    kontak: "0800-5",
    statusAktif: true,
  });
  assert.equal(lain.ok, true);
  const bentrok = await ubahCabang(id, { nama: lain.cabang.nama });
  assert.equal(bentrok.ok, false);
  assert.equal(bentrok.kode, "NAMA_SUDAH_DIPAKAI");

  for (const ulangan of [1, 2]) {
    const nonaktif = await setStatusAktif(id, false);
    assert.equal(nonaktif.statusAktif, false, `nonaktif ke-${ulangan}`);
  }
  assert.equal((await getCabang(id)).statusAktif, false);

  const asing = "0b7f0f1e-0000-4000-8000-000000000000";
  assert.equal(await getCabang(asing), null);
  assert.equal(await setStatusAktif(asing, true), null);
  assert.deepEqual(await ubahCabang(asing, { kontak: "0800-9" }), {
    ok: false,
    kode: "TIDAK_ADA",
    pesan: "Cabang tidak ditemukan.",
  });
});

/**
 * `listCabang` mengurutkan nama tak peka huruf besar-kecil, `getCabangByNama`
 * mencocokkan spasi tepi dan kapitalisasi, dan `ringkasCabang` menghitung
 * seluruh baris tabel.
 */
test("listCabang, getCabangByNama, dan ringkasCabang membaca basis data", async () => {
  await bersihkan();
  const campuran = [`${PENANDA} Zeta`, `${PENANDA} Alfa`, `${PENANDA} beta`];
  for (const nama of campuran)
    await tambahCabang({
      nama,
      alamat: "Jl. Uji No. 6",
      kontak: "0800-6",
      statusAktif: nama !== `${PENANDA} Zeta`,
    });

  const daftar = await listCabang();
  const kunci = daftar.map((cabang) =>
    cabang.nama.trim().toLocaleLowerCase("id"),
  );
  assert.deepEqual(
    kunci,
    [...kunci].sort((a, b) => a.localeCompare(b, "id")),
  );
  const posisi = campuran
    .map((nama) => ({
      nama,
      urutan: kunci.indexOf(nama.trim().toLocaleLowerCase("id")),
    }))
    .sort((a, b) => a.urutan - b.urutan)
    .map((baris) => baris.nama);
  assert.deepEqual(
    posisi,
    [...campuran].sort((a, b) => a.localeCompare(b, "id")),
  );

  const alfa = await getCabangByNama(
    `  ${`${PENANDA} ALFA`.toLocaleUpperCase("id")} `,
  );
  assert.equal(alfa.nama, `${PENANDA} Alfa`);
  assert.equal(await getCabangByNama(`${PENANDA} Tidak Ada`), null);

  const { rows } = await pool.query(
    `SELECT count(*)::int AS jumlah,
            count(*) filter (where status_aktif)::int AS aktif,
            count(*) filter (where not status_aktif)::int AS nonaktif
       FROM cabang`,
  );
  assert.deepEqual(await ringkasCabang(), {
    jumlahCabang: rows[0].jumlah,
    jumlahAktif: rows[0].aktif,
    jumlahNonaktif: rows[0].nonaktif,
  });
  assert.equal(rows[0].aktif >= 2, true);
});
