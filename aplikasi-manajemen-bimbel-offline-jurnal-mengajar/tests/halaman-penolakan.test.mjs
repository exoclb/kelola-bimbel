import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Tampilan penolakan bersama dipakai untuk alamat yang tidak ada sekaligus
// untuk rute yang sengaja ditahan (halaman contoh saat mode rilis, halaman yang
// izinnya tidak dimiliki). Pengguna hanya perlu tahu halamannya tidak bisa
// dibuka — bukan kode galat, nama rute, atau jejak server. Uji ini menjaga
// janji itu, karena tampilannya sendiri tidak bisa ditegakkan oleh tipe.
const akarRepo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const berkasPenolakan = resolve(akarRepo, "src/app/not-found.tsx");

// Komentar dibuang dulu: catatan teknis di dalam kode tidak ikut dinilai,
// yang dinilai hanya isi yang bisa terbaca pengguna.
function isiTampilan(berkas) {
  return readFileSync(berkas, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

test("tampilan penolakan tersedia di berkas not-found milik Next.js", () => {
  assert.ok(
    existsSync(berkasPenolakan),
    "src/app/not-found.tsx tidak ada, jadi notFound() memakai bawaan kerangka kerja.",
  );
});

test("tampilan penolakan tidak membocorkan pesan teknis", () => {
  const tampilan = isiTampilan(berkasPenolakan);
  for (const penanda of [
    "404",
    "Error",
    "error",
    "digest",
    "stack",
    "galat",
    "Server",
  ]) {
    assert.ok(
      !tampilan.includes(penanda),
      `Tampilan penolakan masih memuat "${penanda}".`,
    );
  }
  // Nama rute yang ditahan tidak perlu disebut: justru itu yang disembunyikan.
  assert.ok(
    !tampilan.includes("/app/contoh-status"),
    "Tampilan penolakan menyebut rute halaman contoh.",
  );
});

test("tampilan penolakan memakai bahasa aplikasi dan menyediakan jalan kembali", () => {
  const tampilan = isiTampilan(berkasPenolakan);
  assert.match(
    tampilan,
    /<h1[\s\S]*?Halaman ini tidak tersedia/,
    "Judul penolakan tidak ditemukan atau bukan bahasa Indonesia.",
  );
  assert.match(
    tampilan,
    /href="\/app"/,
    "Tampilan penolakan tidak memberi jalan kembali ke aplikasi.",
  );
  assert.match(
    tampilan,
    /Kembali ke beranda/,
    "Tombol jalan kembali tidak punya label yang jelas.",
  );
  assert.match(
    tampilan,
    /id="main-content"/,
    "Tampilan penolakan tidak bisa dijangkau tautan lompat ke konten utama.",
  );
});
