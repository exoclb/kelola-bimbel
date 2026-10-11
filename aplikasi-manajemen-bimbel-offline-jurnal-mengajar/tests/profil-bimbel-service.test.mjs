import test from "node:test";
import assert from "node:assert/strict";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";
import { Pool } from "pg";

const { ambilProfilBimbel, simpanProfilBimbel } =
  await import("../src/services/pengaturan.service.ts");

// Tabel `bimbel_profile` memang hanya boleh berisi satu baris — indeks unik
// `bimbel_profile_tunggal_idx` pada ekspresi `(true)`. Sampai berkas ini ada,
// yang pernah diuji hanya dua sisi yang tidak bertemu: `tests/database.test.mjs`
// membuktikan `INSERT` baris kedua ditolak basis data, dan
// `e2e/profil-bimbel.spec.ts` membuktikan dua simpan berurutan lewat HTTP
// menimpa baris yang sama. Yang belum pernah dijalankan justru jalur yang
// ditulis khusus untuk itu di `simpanProfilBimbel`: ketika dua penyimpanan
// pertama datang *bersamaan* (barisnya belum ada), yang kalah balapan di indeks
// unik harus ditangkap lalu diulang sebagai pembaruan — bukan dilempar ke
// pemanggil sebagai galat 500. Diuji di sini juga bentuk "profil belum pernah
// diatur", karena pembacanya (`/app/pengaturan/profil` dan kop dokumen) memang
// menerima bentuk itu alih-alih baris kosong.
//
// Tabelnya singleton, jadi berkas ini tidak bisa berjalan berdampingan dengan
// tes lain yang menyentuh tabel yang sama: jalankan dengan
// `--test-concurrency=1` (sama seperti `tests/database.test.mjs`).
const pool = new Pool({
  connectionString: process.env.STARTER_TEST_DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

const KOLOM = ["alamat", "email", "logo", "nama", "telepon", "updatedAt"];

/** Bentuk isian yang lengkap, semua kolom terisi. */
function isian(nama, tambahan = {}) {
  return {
    nama,
    alamat: "Jl. Uji Profil 1",
    telepon: "081200000001",
    email: "profil@bimbel.test",
    logo: "data:image/png;base64,iVBORw0KGgo=",
    ...tambahan,
  };
}

/** Hapus profil yang tersisa dari tes sebelumnya. */
async function bersihkan() {
  await pool.query("DELETE FROM bimbel_profile");
}

/** Baris mentah tabelnya, dipakai untuk memeriksa yang benar-benar tersimpan. */
async function baris() {
  const { rows } = await pool.query(
    "SELECT id, nama, alamat, telepon, email, logo, updated_at FROM bimbel_profile",
  );
  return rows;
}

test("profil kosong dibaca sebagai bentuk kosong, bukan galat", async () => {
  await bersihkan();

  const profil = await ambilProfilBimbel();
  assert.deepEqual(profil, {
    nama: "",
    alamat: "",
    telepon: "",
    email: "",
    logo: null,
    updatedAt: null,
  });
  assert.equal((await baris()).length, 0, "membaca tidak membuat baris");
});

test("simpan pertama membuat satu baris bersisi kolom yang dirender layar", async () => {
  await bersihkan();

  const tersimpan = await simpanProfilBimbel(isian("Bimbel Uji Pertama"));
  assert.deepEqual(Object.keys(tersimpan).sort(), KOLOM);
  assert.equal(tersimpan.nama, "Bimbel Uji Pertama");
  assert.equal(tersimpan.alamat, "Jl. Uji Profil 1");
  assert.equal(tersimpan.telepon, "081200000001");
  assert.equal(tersimpan.email, "profil@bimbel.test");
  assert.equal(tersimpan.logo, "data:image/png;base64,iVBORw0KGgo=");
  assert.ok(tersimpan.updatedAt instanceof Date);

  const tersimpanDiBasisData = await baris();
  assert.equal(tersimpanDiBasisData.length, 1, "barisnya tepat satu");
  assert.equal(tersimpanDiBasisData[0].nama, "Bimbel Uji Pertama");

  // Pembacaan berikutnya mengembalikan baris yang sama, bukan bentuk kosong.
  assert.equal((await ambilProfilBimbel()).nama, "Bimbel Uji Pertama");
});

test("simpan berulang mengubah baris yang sama, bukan menambah baris", async () => {
  await bersihkan();

  await simpanProfilBimbel(isian("Bimbel Uji Awal"));
  const [sebelum] = await baris();

  await new Promise((lanjut) => setTimeout(lanjut, 10));
  const kedua = await simpanProfilBimbel(
    isian("Bimbel Uji Berikutnya", { alamat: "" }),
  );

  const sesudah = await baris();
  assert.equal(sesudah.length, 1, "tetap satu baris walau disimpan dua kali");
  assert.equal(sesudah[0].id, sebelum.id, "id barisnya tidak berubah");
  assert.equal(sesudah[0].nama, "Bimbel Uji Berikutnya");
  assert.equal(sesudah[0].alamat, "");
  assert.equal(kedua.nama, "Bimbel Uji Berikutnya");
  assert.ok(
    kedua.updatedAt.getTime() > sebelum.updated_at.getTime(),
    "waktu ubahnya ikut bergerak",
  );
});

test("logo null menghapus logo yang tersimpan", async () => {
  await bersihkan();

  await simpanProfilBimbel(isian("Bimbel Uji Logo"));
  assert.equal((await baris())[0].logo, "data:image/png;base64,iVBORw0KGgo=");

  const dihapus = await simpanProfilBimbel(
    isian("Bimbel Uji Logo", { logo: null }),
  );
  assert.equal(dihapus.logo, null);
  assert.equal((await baris())[0].logo, null);
});

test("kontak kosong tetap boleh disimpan sebagai teks kosong", async () => {
  await bersihkan();

  const tersimpan = await simpanProfilBimbel(
    isian("Bimbel Uji Kontak", { alamat: "", telepon: "", email: "" }),
  );
  assert.deepEqual(
    [tersimpan.alamat, tersimpan.telepon, tersimpan.email],
    ["", "", ""],
  );
  const [tersimpanDiBasisData] = await baris();
  assert.deepEqual(
    [
      tersimpanDiBasisData.alamat,
      tersimpanDiBasisData.telepon,
      tersimpanDiBasisData.email,
    ],
    ["", "", ""],
    "kolom NOT NULL-nya terisi teks kosong, bukan null",
  );
});

/**
 * Memastikan kolam koneksi layanan menyisakan lebih dari satu sambungan
 * menganggur. Kalau hanya ada satu, permintaan kedua membuka sambungan baru dan
 * transaksinya baru mulai setelah transaksi pertama selesai — balapannya tidak
 * pernah terjadi, `SELECT` yang kedua sudah melihat barisnya, dan tesnya jadi
 * hampa. Dijalankan berdampingan supaya dua sambungan sekaligus terpakai.
 */
async function hangatkanKolam() {
  await Promise.all([ambilProfilBimbel(), ambilProfilBimbel()]);
}

test("dua simpan pertama yang datang bersamaan tetap menghasilkan satu baris", async () => {
  // Diulang beberapa ronde karena balapannya bergantung pada urutan tiba di
  // server, bukan pada isi permintaannya.
  for (let ronde = 1; ronde <= 3; ronde += 1) {
    await bersihkan();
    await hangatkanKolam();
    const namaA = `Bimbel Uji Serentak ${ronde}A`;
    const namaB = `Bimbel Uji Serentak ${ronde}B`;

    // Dijalankan berdampingan seperti dua perangkat yang menekan "Simpan
    // profil" pada saat yang hampir sama, saat barisnya belum ada. Yang kalah
    // balapan ditangkap indeks unik lalu diulang sebagai pembaruan.
    const [satu, dua] = await Promise.all([
      simpanProfilBimbel(isian(namaA)),
      simpanProfilBimbel(isian(namaB)),
    ]);

    const tersimpan = await baris();
    assert.equal(
      tersimpan.length,
      1,
      `ronde ${ronde}: indeks unik tunggal yang menahan baris kedua`,
    );
    const nama = tersimpan[0].nama;
    assert.ok(
      [namaA, namaB].includes(nama),
      `ronde ${ronde}: nama tersimpan harus salah satu isian, dapat ${nama}`,
    );
    // Kedua pemanggil dapat jawaban yang bisa dipakai, bukan galat: yang menang
    // mengembalikan barisnya sendiri, yang kalah hasil pembaruan setelah ulang.
    for (const hasil of [satu, dua]) {
      assert.deepEqual(Object.keys(hasil).sort(), KOLOM);
      assert.ok(hasil.updatedAt instanceof Date);
    }
    assert.equal(
      (await ambilProfilBimbel()).nama,
      nama,
      `ronde ${ronde}: pembacaan berikutnya melihat baris yang sama`,
    );
  }
});

test.after(async () => {
  await bersihkan();
  await pool.end();
});
