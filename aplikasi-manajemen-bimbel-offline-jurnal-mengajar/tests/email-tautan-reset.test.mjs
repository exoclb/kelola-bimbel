import test from "node:test";
import assert from "node:assert/strict";
import {
  MASA_BERLAKU_MENIT_BAWAAN,
  escapeHtml,
  htmlEmailTautanReset,
  subjekEmailTautanReset,
  teksEmailTautanReset,
} from "../src/lib/email-tautan-reset.ts";

// Isi email menentukan apa yang dilihat guru pemilik akun: tautannya harus ada,
// masa berlakunya jelas, dan nilainya harus aman masuk HTML. Uji di sini hanya
// menyentuh berkas isi (tanpa jaringan maupun basis data).

const TAUTAN = "http://localhost:3000/atur-ulang-password?token=abc123";
const ISI = {
  namaBimbel: "Bimbel Contoh",
  alamatPenerima: "guru@contoh.id",
  namaPengguna: "Bu Sri",
  tautan: TAUTAN,
};

test("subjek email menyebut nama bimbel", () => {
  assert.equal(
    subjekEmailTautanReset("Bimbel Contoh"),
    "Atur ulang sandi Bimbel Contoh",
  );
});

test("versi teks memuat tautan, alamat tujuan, dan masa berlaku", () => {
  const teks = teksEmailTautanReset(ISI);
  assert.match(teks, /Halo Bu Sri,/);
  assert.ok(teks.includes(TAUTAN), "tautan harus ada apa adanya");
  assert.ok(teks.includes("guru@contoh.id"), "alamat tujuan ikut disebut");
  assert.ok(
    teks.includes("Bimbel Contoh"),
    "nama bimbel dipakai di salam & tanda tangan",
  );
  assert.match(teks, new RegExp(`${MASA_BERLAKU_MENIT_BAWAAN} menit`));
  assert.match(teks, /abaikan saja email ini/);
});

test("tanpa nama akun, sapaan tetap sopan", () => {
  const teks = teksEmailTautanReset({ ...ISI, namaPengguna: undefined });
  assert.match(teks, /^Halo,/);
  assert.doesNotMatch(teks, /undefined/);

  // Nama yang cuma berisi spasi tidak boleh jadi salam kosong.
  const kosong = teksEmailTautanReset({ ...ISI, namaPengguna: "   " });
  assert.match(kosong, /^Halo,/);
});

test("masa berlaku bisa disesuaikan dan ikut ke teks maupun HTML", () => {
  const isi = { ...ISI, berlakuMenit: 15 };
  assert.match(teksEmailTautanReset(isi), /berlaku 15 menit/);
  assert.match(htmlEmailTautanReset(isi), /berlaku 15 menit/);
});

test("versi HTML memuat tautan yang bisa diklik dan teks cadangannya", () => {
  const html = htmlEmailTautanReset(ISI);
  assert.ok(html.includes(`href="${TAUTAN}"`), "tautan harus jadi href");
  assert.ok(
    html.split(TAUTAN).length - 1 >= 2,
    "tautan juga ditampilkan sebagai teks agar bisa disalin",
  );
  assert.match(html, /Buat sandi baru/);
  assert.match(html, /Bimbel Contoh/);
});

test("nilai dari luar di-escape sebelum masuk HTML", () => {
  const html = htmlEmailTautanReset({
    namaBimbel: '<script>alert("x")</script>',
    alamatPenerima: "guru@contoh.id",
    namaPengguna: 'Bu <b>Sri</b> & "Rani"',
    tautan: 'http://contoh.id/atur?token=a"b<c>',
  });

  assert.doesNotMatch(html, /<script>/, "nama bimbel tidak boleh jadi tag");
  assert.doesNotMatch(html, /<b>Sri<\/b>/, "nama akun tidak boleh jadi tag");
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Bu &lt;b&gt;Sri&lt;\/b&gt; &amp; &quot;Rani&quot;/);
  assert.match(html, /token=a&quot;b&lt;c&gt;/);
});

test("escapeHtml mengganti kelima karakter berbahaya sekali saja", () => {
  assert.equal(escapeHtml(`&<>"'`), "&amp;&lt;&gt;&quot;&#39;");
  // "&" didahulukan supaya entitas yang sudah ada tidak di-escape dua kali.
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  assert.equal(escapeHtml("aman"), "aman");
});
