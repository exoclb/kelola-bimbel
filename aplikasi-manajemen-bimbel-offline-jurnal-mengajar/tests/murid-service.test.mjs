import test from "node:test";
import assert from "node:assert/strict";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";
import { Pool } from "pg";

const { createMurid, getMurid, listMurid, ubahMurid } =
  await import("../src/services/murid.service.ts");

const PENANDA = "Uji Layanan Murid";
const CABANG = `${PENANDA} Cabang`;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/**
 * Hapus baris uji berkas ini; dipanggil sebelum dan sesudah tiap tes. Urutannya
 * dari yang paling bergantung: penempatan ikut terhapus bersama kelas dan
 * muridnya, dan kelas harus pergi sebelum cabangnya.
 */
async function bersihkan() {
  await pool.query("DELETE FROM classes WHERE nama_kelas LIKE $1", [
    `%${PENANDA}%`,
  ]);
  await pool.query("DELETE FROM students WHERE nama LIKE $1", [`%${PENANDA}%`]);
  await pool.query("DELETE FROM cabang WHERE nama LIKE $1", [`%${PENANDA}%`]);
}

/** Isian murid baru yang lengkap; tiap tes cukup menimpa yang perlu diubah. */
function isian(nama, tambahan = {}) {
  return {
    nama,
    tanggalLahir: "2014-03-02",
    namaOrangTua: "Ibu Uji",
    kontakOrangTua: "0812-0000-0001",
    statusAktif: true,
    ...tambahan,
  };
}

/**
 * Siapkan satu kelas beserta cabangnya (kelas wajib menunjuk cabang yang ada)
 * dan kembalikan idnya.
 */
async function siapkanKelas(namaKelas, namaCabang = CABANG) {
  await pool.query(
    `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
     VALUES ($1, 'Jl. Uji No. 1', '0800-1', true)
     ON CONFLICT (lower(btrim(nama))) DO NOTHING`,
    [namaCabang],
  );
  const { rows } = await pool.query(
    "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2) RETURNING id",
    [namaKelas, namaCabang],
  );
  return rows[0].id;
}

/** Tempatkan murid di kelas lewat basis data, seperti penempatan yang tersimpan. */
async function tempatkan(muridId, kelasId, status = "aktif") {
  await pool.query(
    `INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status)
     VALUES ($1, $2, '2026-01-05', $3)`,
    [muridId, kelasId, status],
  );
}

test.after(async () => {
  await bersihkan();
  await pool.end();
});

/**
 * Bentuk baris yang diterima komponen: layanan murid mengembalikan persis kolom
 * identitas yang dirender tampilan, dan isian orang tua yang kosong tersimpan
 * sebagai `NULL` — bukan teks kosong yang membingungkan tampilan.
 */
test("baris murid memuat kolom identitas dan isian kosong jadi NULL", async () => {
  await bersihkan();
  const dibuat = await createMurid(
    isian(`${PENANDA} Bentuk`, { namaOrangTua: "   ", kontakOrangTua: "" }),
  );

  const baris = await getMurid(dibuat.id);
  assert.deepEqual(Object.keys(baris).sort(), [
    "createdAt",
    "id",
    "kontakOrangTua",
    "nama",
    "namaOrangTua",
    "statusAktif",
    "tanggalLahir",
  ]);
  assert.equal(baris.nama, `${PENANDA} Bentuk`);
  assert.equal(baris.namaOrangTua, null);
  assert.equal(baris.kontakOrangTua, null);
  assert.equal(baris.tanggalLahir, "2014-03-02");
  assert.equal(baris.statusAktif, true);
  assert.equal(baris.createdAt instanceof Date, true);

  // Id asing tidak ditemukan, bukan melempar galat.
  assert.equal(await getMurid("0b7f0f1e-0000-4000-8000-000000000000"), null);
});

/**
 * `ubahMurid` hanya menulis kolom yang benar-benar dikirim, mengosongkan isian
 * orang tua saat diminta, dan menolak id yang tidak ada.
 */
test("ubahMurid mengubah sebagian kolom dan mengosongkan isian orang tua", async () => {
  await bersihkan();
  const dibuat = await createMurid(isian(`${PENANDA} Ubah`));

  const digantiNama = await ubahMurid(dibuat.id, {
    nama: `${PENANDA} Ubah Baru`,
  });
  assert.equal(digantiNama.ok, true);
  assert.equal(digantiNama.murid.nama, `${PENANDA} Ubah Baru`);
  // Kolom yang tidak dikirim tetap seperti semula.
  assert.equal(digantiNama.murid.tanggalLahir, "2014-03-02");
  assert.equal(digantiNama.murid.namaOrangTua, "Ibu Uji");
  assert.equal(digantiNama.murid.kontakOrangTua, "0812-0000-0001");

  const dikosongkan = await ubahMurid(dibuat.id, { namaOrangTua: "  " });
  assert.equal(dikosongkan.ok, true);
  assert.equal(dikosongkan.murid.namaOrangTua, null);
  assert.equal(dikosongkan.murid.kontakOrangTua, "0812-0000-0001");
  // Perubahannya benar-benar tersimpan, bukan cuma ada di balasan.
  assert.equal((await getMurid(dibuat.id)).namaOrangTua, null);

  assert.deepEqual(
    await ubahMurid("0b7f0f1e-0000-4000-8000-000000000000", {
      nama: `${PENANDA} Hantu`,
    }),
    { ok: false, kode: "TIDAK_ADA", pesan: "Murid tidak ditemukan." },
  );
});

/**
 * Menonaktifkan murid tidak menghapus barisnya maupun penempatan kelasnya:
 * kelas yang sedang diikuti dan riwayatnya tetap utuh, yang berubah hanya
 * statusnya. Menekan tombol yang sama dua kali menghasilkan keadaan yang sama.
 */
test("menonaktifkan murid menyimpan barisnya dan penempatannya", async () => {
  await bersihkan();
  const dibuat = await createMurid(isian(`${PENANDA} Nonaktif`));
  await tempatkan(dibuat.id, await siapkanKelas(`${PENANDA} Kelas Nonaktif`));

  for (const ulangan of [1, 2]) {
    const nonaktif = await ubahMurid(dibuat.id, { statusAktif: false });
    assert.equal(nonaktif.ok, true, `nonaktif ke-${ulangan}`);
    assert.equal(nonaktif.murid.statusAktif, false, `nonaktif ke-${ulangan}`);
  }

  const tersimpan = await getMurid(dibuat.id);
  assert.equal(tersimpan.statusAktif, false);
  assert.equal(tersimpan.nama, `${PENANDA} Nonaktif`);
  const penempatan = await pool.query(
    "SELECT status FROM student_enrollments WHERE student_id = $1",
    [dibuat.id],
  );
  assert.deepEqual(penempatan.rows, [{ status: "aktif" }]);

  const aktifLagi = await ubahMurid(dibuat.id, { statusAktif: true });
  assert.equal(aktifLagi.ok, true);
  assert.equal(aktifLagi.murid.statusAktif, true);
});

/**
 * `listMurid` menyaring status dan kata kunci (nama murid, nama orang tua, atau
 * kontaknya, dengan `%` dan `_` dianggap huruf biasa), sementara `meta`
 * menghitung total dan yang aktif supaya pemilih penempatan bisa menampilkan
 * angkanya.
 */
test("listMurid menyaring status dan kata kunci", async () => {
  await bersihkan();
  const aktif = await createMurid(isian(`${PENANDA} Aktif`));
  const nonaktif = await createMurid(
    isian(`${PENANDA} Nonaktif`, {
      namaOrangTua: "Bapak 100%",
      kontakOrangTua: "0812-9999-0002",
    }),
  );
  await ubahMurid(nonaktif.id, { statusAktif: false });

  // Saringan ini dipasangkan dengan penanda berkas: berkas uji lain memakai
  // basis data yang sama, jadi jumlah total seluruh tabel bukan milik tes ini.
  const semua = await listMurid({ limit: 50, offset: 0, cari: PENANDA });
  assert.equal(semua.meta.total, 2);
  assert.equal(semua.meta.aktif, 1);
  // Terurut nama murid, jadi yang berakhiran "Aktif" lebih dulu.
  assert.deepEqual(
    semua.data.map((baris) => baris.nama),
    [`${PENANDA} Aktif`, `${PENANDA} Nonaktif`],
  );

  const aktifSaja = await listMurid({
    limit: 50,
    offset: 0,
    status: "aktif",
    cari: PENANDA,
  });
  assert.deepEqual(
    aktifSaja.data.map((baris) => baris.id),
    [aktif.id],
  );

  const nonaktifSaja = await listMurid({
    limit: 50,
    offset: 0,
    status: "nonaktif",
    cari: PENANDA,
  });
  assert.deepEqual(
    nonaktifSaja.data.map((baris) => baris.id),
    [nonaktif.id],
  );

  const lewatKontak = await listMurid({
    limit: 50,
    offset: 0,
    cari: "0812-9999",
  });
  assert.equal(
    lewatKontak.data.some((baris) => baris.id === nonaktif.id),
    true,
  );

  // Tanda persen dicari apa adanya, bukan sebagai pola SQL.
  const harfiah = await listMurid({ limit: 50, offset: 0, cari: "100%" });
  assert.equal(
    harfiah.data.some((baris) => baris.id === nonaktif.id),
    true,
  );
  const garisBawah = await listMurid({ limit: 50, offset: 0, cari: "10_%" });
  assert.equal(
    garisBawah.data.some((baris) => baris.id === nonaktif.id),
    false,
  );
});

/**
 * `tanpaKelas` menyembunyikan murid yang sudah aktif di kelas itu — dipakai
 * pemilih penempatan supaya anak yang sama tidak ditawarkan dua kali — dan
 * kelas lain tetap menawarkannya.
 */
test("listMurid dengan tanpaKelas menyembunyikan murid yang sudah di kelas", async () => {
  await bersihkan();
  const dibuat = await createMurid(isian(`${PENANDA} Kelas`));
  const kelasId = await siapkanKelas(`${PENANDA} Kelas Saring`);
  await tempatkan(dibuat.id, kelasId);

  const tersembunyi = await listMurid({
    limit: 50,
    offset: 0,
    tanpaKelas: kelasId,
  });
  assert.equal(
    tersembunyi.data.some((baris) => baris.id === dibuat.id),
    false,
  );

  const kelasLain = await listMurid({
    limit: 50,
    offset: 0,
    tanpaKelas: "0b7f0f1e-0000-4000-8000-000000000000",
  });
  assert.equal(
    kelasLain.data.some((baris) => baris.id === dibuat.id),
    true,
  );
});

/**
 * Penyaring cabang dan kelas mengikuti layar: yang dihitung hanya penempatan
 * yang masih `aktif`. Murid yang sudah keluar dari kelasnya tidak lagi muncul
 * saat menyaring kelas itu — kalau tidak, saringan cabang/kelas akan berbeda
 * dari yang terlihat di kartu muridnya.
 */
test("listMurid menyaring cabang dan kelas dari penempatan aktif", async () => {
  await bersihkan();
  const cabangUtara = `${PENANDA} Utara`;
  const kelasUtara = await siapkanKelas(`${PENANDA} Kelas Utara`, cabangUtara);
  const kelasPusat = await siapkanKelas(`${PENANDA} Kelas Pusat`, CABANG);

  const diUtara = await createMurid(isian(`${PENANDA} Di Utara`));
  const diPusat = await createMurid(isian(`${PENANDA} Di Pusat`));
  const tanpaKelas = await createMurid(isian(`${PENANDA} Tanpa Kelas`));
  const pernahUtara = await createMurid(isian(`${PENANDA} Pernah Utara`));
  await tempatkan(diUtara.id, kelasUtara);
  await tempatkan(diPusat.id, kelasPusat);
  await tempatkan(pernahUtara.id, kelasUtara, "selesai");
  // Satu murid boleh di dua cabang sekaligus.
  await tempatkan(diPusat.id, kelasUtara);

  const cari = (saringan) =>
    listMurid({ limit: 50, offset: 0, cari: PENANDA, ...saringan });

  const utara = await cari({ cabang: cabangUtara });
  assert.deepEqual(
    utara.data.map((baris) => baris.nama),
    [`${PENANDA} Di Pusat`, `${PENANDA} Di Utara`],
  );
  assert.equal(utara.meta.total, 2);

  // Nama cabang dicocokkan tanpa peduli besar/kecil huruf dan spasi tepi.
  assert.equal(
    (await cari({ cabang: `  ${cabangUtara.toUpperCase()}  ` })).meta.total,
    2,
  );
  // Cabang yang tidak dipakai siapa pun menghasilkan daftar kosong, bukan
  // seluruh murid.
  assert.deepEqual((await cari({ cabang: `${PENANDA} Selatan` })).data, []);
  // Nilai kosong berarti tanpa penyaringan.
  assert.equal((await cari({ cabang: "" })).meta.total, 4);

  const kelas = await cari({ kelasId: kelasUtara });
  assert.deepEqual(
    kelas.data.map((baris) => baris.nama),
    [`${PENANDA} Di Pusat`, `${PENANDA} Di Utara`],
  );
  assert.equal(
    (await cari({ kelasId: kelasPusat })).data.some(
      (baris) => baris.id === tanpaKelas.id,
    ),
    false,
  );
  assert.equal((await cari({ kelasId: kelasPusat })).meta.total, 1);

  // Penyaring cabang/kelas bisa digabung dengan status murid.
  await ubahMurid(diUtara.id, { statusAktif: false });
  const utaraAktif = await cari({ cabang: cabangUtara, status: "aktif" });
  assert.deepEqual(
    utaraAktif.data.map((baris) => baris.nama),
    [`${PENANDA} Di Pusat`],
  );
  assert.equal(utaraAktif.meta.total, 1);
  assert.equal(
    (await cari({ cabang: cabangUtara, status: "nonaktif" })).meta.total,
    1,
  );
});
