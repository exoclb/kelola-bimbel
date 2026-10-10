import test from "node:test";
import assert from "node:assert/strict";
import {
  NAMA_BIMBEL_CADANGAN,
  amanHtml,
  kopDokumenHtml,
} from "../src/lib/dokumen-html.ts";

const profil = {
  nama: "Bimbel Cerdas Nusantara",
  alamat: "Jl. Melati No. 12, Bandung",
  telepon: "0812-3456-7890",
  email: "admin@cerdasnusantara.test",
};

// Kop dokumen mandiri dipakai slip gaji dan bukti tagihan sekaligus, jadi
// urutan bagiannya (nama, kontak, judul) dan kolom kanannya perlu dijaga.
test("kop dokumen HTML memuat nama, kontak, judul, dan kolom kanan", () => {
  const html = kopDokumenHtml({
    profil,
    judul: "Slip gaji guru · Oktober 2026",
    kanan: '<p class="status">Sudah dibayar</p>',
  });

  const nama = html.indexOf("<h1>Bimbel Cerdas Nusantara</h1>");
  const kontak = html.indexOf(
    '<p class="periode">Jl. Melati No. 12, Bandung · 0812-3456-7890 · admin@cerdasnusantara.test</p>',
  );
  const judul = html.indexOf("<p>Slip gaji guru · Oktober 2026</p>");
  const kanan = html.indexOf('<p class="status">Sudah dibayar</p>');

  assert.ok(nama >= 0, "nama bimbel harus ada");
  assert.ok(kontak > nama, "kontak berada di bawah nama");
  assert.ok(judul > kontak, "judul dokumen berada di bawah kontak");
  assert.ok(kanan > judul, "kolom kanan berada di ujung kop");
});

// Kolom kanan dan judul tidak wajib: bukti tagihan hanya memakai identitas,
// dan kop tanpa keduanya tidak boleh menyisakan potongan markup kosong.
test("kop dokumen HTML tanpa judul dan kolom kanan tetap utuh", () => {
  const html = kopDokumenHtml({ profil });

  assert.ok(html.includes("<h1>Bimbel Cerdas Nusantara</h1>"));
  assert.ok(html.includes('<p class="periode">Jl. Melati No. 12, Bandung'));
  assert.ok(!html.includes("<p></p>"), "judul kosong tidak ikut dicetak");
  assert.equal((html.match(/<div>/g) ?? []).length, 1);
});

// Profil bimbel bisa saja masih kosong; dokumen yang diunduh tidak boleh
// mencetak paragraf kontak kosong atau judul tanpa nama.
test("kop dokumen HTML memakai nama cadangan dan melewati kontak kosong", () => {
  const kosong = { nama: "  ", alamat: "", telepon: "", email: "" };
  const html = kopDokumenHtml({ profil: kosong, judul: "Laporan" });

  assert.ok(html.includes(`<h1>${NAMA_BIMBEL_CADANGAN}</h1>`));
  assert.ok(!html.includes('<p class="periode">'), "kontak kosong dilewati");
  assert.ok(html.includes("<p>Laporan</p>"));
});

// Nama bimbel, alamat, dan judul datang dari basis data, jadi bisa berisi
// tanda kurung siku; kop harus meloloskannya supaya dokumen tidak bisa
// menyisipkan skrip.
test("kop dokumen HTML meloloskan teks dari basis data", () => {
  const html = kopDokumenHtml({
    profil: {
      nama: 'Bimbel <script>alert("x")</script>',
      alamat: "Jl. A & B",
      telepon: "",
      email: "",
    },
    judul: "Laporan <b>palsu</b>",
  });

  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<b>"));
  assert.ok(html.includes("Bimbel &lt;script&gt;"));
  assert.ok(html.includes("Jl. A &amp; B"));
  assert.ok(html.includes("Laporan &lt;b&gt;palsu&lt;/b&gt;"));
});

// Satu pelolos teks dipakai semua penolong dokumen: tanda kutip pun ikut
// diloloskan, jadi tidak ada penolong yang bisa lupa melakukannya.
test("pelolos teks dokumen menutup tanda kutip", () => {
  assert.equal(
    amanHtml(`Bu "Ani" & <b>'x'</b>`),
    "Bu &quot;Ani&quot; &amp; &lt;b&gt;&#39;x&#39;&lt;/b&gt;",
  );
});
