import test from "node:test";
import assert from "node:assert/strict";
import {
  kopLembarTeks,
  lembarLaporanHtml,
  namaBerkasLembar,
} from "../src/lib/lembar-laporan-html.ts";

const profil = {
  nama: "Bimbel Cerdas Nusantara",
  alamat: "Jl. Melati No. 12, Bandung",
  telepon: "0812-3456-7890",
  email: "admin@cerdasnusantara.test",
};

// Lembar ini dipakai berkas Excel yang diunduh owner, jadi kop, judul kolom,
// dan pelolosan teksnya perlu dijaga.
test("lembar laporan memuat kop profil dan tabel berjudul kolom", () => {
  const html = lembarLaporanHtml({
    judul: "Rekap Gaji Guru",
    periode: "Oktober 2026",
    profil,
    kolom: ["Guru", "Total Gaji (Rp)"],
    baris: [["Bu Sari", 450000]],
  });

  assert.match(html, /<h2 style="margin:0">Bimbel Cerdas Nusantara<\/h2>/);
  assert.ok(html.includes(kopLembarTeks(profil)));
  assert.ok(html.includes("Rekap Gaji Guru — Oktober 2026"));
  assert.equal((html.match(/<th align="left" scope="col">/g) ?? []).length, 2);
  // Angka ditulis apa adanya supaya masih bisa dijumlahkan di lembar kerja.
  assert.ok(html.includes("<td>450000</td>"));
});

test("lembar laporan meloloskan teks dari data", () => {
  const html = lembarLaporanHtml({
    judul: "Rekap Gaji Guru",
    periode: "Oktober 2026",
    profil,
    kolom: ["Guru"],
    baris: [["Ahmad <Fauzi> & Rekan"]],
  });

  assert.ok(html.includes("Ahmad &lt;Fauzi&gt; &amp; Rekan"));
  assert.ok(!html.includes("<Fauzi>"));
});

test("nama berkas lembar disusun dari judul dan periode", () => {
  assert.equal(
    namaBerkasLembar("Rekap Gaji Guru", "Oktober 2026", "xls"),
    "rekap-gaji-guru-oktober-2026.xls",
  );
});
