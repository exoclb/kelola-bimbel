import test from "node:test";
import assert from "node:assert/strict";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";
import { Pool } from "pg";

const { ambilKopLaporan } =
  await import("../src/services/kop-laporan.service.ts");
const { ambilProfilBimbel, simpanLogoBimbel, simpanProfilBimbel } =
  await import("../src/services/pengaturan.service.ts");
const { kopDokumenHtml, NAMA_BIMBEL_CADANGAN } =
  await import("../src/lib/dokumen-html.ts");

// Semua tempat yang mencetak dokumen — rekap gaji, slip guru, bukti tagihan
// wali, laporan arus kas, laba rugi, dan laporan perkembangan — butuh satu hal
// yang sama: identitas bimbel dari profil yang tersimpan. Sampai berkas ini ada,
// yang diuji cuma dua ujungnya: `tests/kop-dokumen.test.mjs` menguji perakitan
// kop dari `ProfilDokumen` mana pun (termasuk nama cadangan), dan
// `tests/profil-bimbel-service.test.mjs` menguji pembacaan/simpan profilnya.
// Yang belum pernah dijalankan adalah jalur di antaranya, yaitu layanan yang
// mengubah baris tersimpan menjadi kop siap cetak: pembacaan yang tidak
// menyentuh tabel kosong dengan galat, pemangkasan tepi kolom teks, dan
// penjaminan bahwa kop-nya tidak pernah muncul tanpa nama penerbit.
//
// Tabelnya singleton, jadi berkas ini tidak bisa berjalan berdampingan dengan
// tes lain yang menyentuh tabel yang sama: jalankan dengan
// `--test-concurrency=1` (sama seperti `tests/database.test.mjs`).
const pool = new Pool({
  connectionString: process.env.STARTER_TEST_DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

const LOGO = "data:image/png;base64,iVBORw0KGgo=";

async function bersihkan() {
  await pool.query("DELETE FROM bimbel_profile");
}

test("kop dari tabel kosong tetap menyebut penerbitnya", async () => {
  await bersihkan();

  // Kontrol: barisnya memang belum ada, jadi nama tersimpannya benar-benar
  // kosong — nama cadangan di bawah ini datang dari layanannya, bukan dari
  // isian yang kebetulan sudah terisi.
  const tersimpan = await ambilProfilBimbel();
  assert.equal(tersimpan.nama, "");

  assert.deepEqual(await ambilKopLaporan(), {
    nama: NAMA_BIMBEL_CADANGAN,
    alamat: "",
    telepon: "",
    email: "",
    logo: null,
  });
});

test("kop mengikuti profil tersimpan dan memangkas tepi kolomnya", async () => {
  await bersihkan();
  await simpanProfilBimbel({
    nama: "  Bimbel Ilmu Nusantara  ",
    alamat: "  Jl. Melati 3  ",
    telepon: "  081200000002  ",
    // Kolom email tidak ikut dipangkas di uji ini: basis data menuntut
    // bentuknya alamat yang sah tanpa spasi tepi (`bimbel_profile_email_valid`),
    // jadi nilai ber-spasi memang tidak bisa tersimpan di kolom itu.
    email: "kop@bimbel.test",
    logo: LOGO,
  });

  assert.deepEqual(await ambilKopLaporan(), {
    nama: "Bimbel Ilmu Nusantara",
    alamat: "Jl. Melati 3",
    telepon: "081200000002",
    email: "kop@bimbel.test",
    logo: LOGO,
  });

  // Nilai yang disimpan apa adanya oleh service (validator HTTP yang
  // memangkasnya, service tidak), jadi yang dipangkas di sini memang layanan
  // kopnya — bukan kebetulan dari penyimpanannya.
  const tersimpan = await ambilProfilBimbel();
  assert.equal(tersimpan.nama, "  Bimbel Ilmu Nusantara  ");

  // Logonya bisa diganti tanpa menyentuh nama dan kontaknya, dan kop yang
  // dicetak ikut berubah — sumbernya baris tersimpan, bukan nilai yang
  // dioper halaman.
  const lain = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
  const hasil = await simpanLogoBimbel(lain);
  assert.equal(hasil.ok, true);
  assert.deepEqual(await ambilKopLaporan(), {
    nama: "Bimbel Ilmu Nusantara",
    alamat: "Jl. Melati 3",
    telepon: "081200000002",
    email: "kop@bimbel.test",
    logo: lain,
  });

  // Baris yang dihapus mengembalikan kopnya ke cadangan: pembacaannya selalu
  // dari basis data, tidak ada nilai yang tersimpan di memori proses.
  await bersihkan();
  assert.equal((await ambilKopLaporan()).nama, NAMA_BIMBEL_CADANGAN);
});

test("kop dari layanan langsung bisa dipakai dokumen cetak", async () => {
  await bersihkan();

  // Dokumen mandiri (unduhan/ekspor) memakai penolong yang sama dengan kop di
  // layar, jadi yang diuji di sini sambungannya: `ambilKopLaporan()` cukup
  // dioper apa adanya, tanpa halaman perlu menambal nama cadangannya sendiri.
  const kosong = kopDokumenHtml({
    profil: await ambilKopLaporan(),
    judul: "Rekap Gaji Guru",
    kanan: "Agustus 2097",
  });
  assert.match(kosong, new RegExp(`<h1>${NAMA_BIMBEL_CADANGAN}</h1>`));
  // Profil kosong tidak boleh menyisakan baris kontak kosong di kopnya.
  assert.equal(kosong.includes("<p></p>"), false);
  assert.equal(
    /<p>\s*·|·\s*<\/p>/.test(kosong),
    false,
    "baris kontak tidak boleh berisi pemisah menggantung",
  );

  await simpanProfilBimbel({
    nama: "Bimbel Kop Cetak",
    alamat: "Jl. Kenanga 9",
    telepon: "081200000003",
    email: "",
    logo: null,
  });
  const terisi = kopDokumenHtml({
    profil: await ambilKopLaporan(),
    judul: "Rekap Gaji Guru",
    kanan: "Agustus 2097",
  });
  assert.match(terisi, /<h1>Bimbel Kop Cetak<\/h1>/);
  assert.match(terisi, /Jl\. Kenanga 9 · 081200000003/);
  // Kontak yang kosong tidak ikut dicetak, jadi tidak ada " · " menggantung.
  assert.equal(terisi.includes("081200000003 ·"), false);
});
