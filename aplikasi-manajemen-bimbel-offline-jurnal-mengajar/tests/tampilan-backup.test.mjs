// Uji pembantu tampilan modul backup (src/lib/tampilan-backup.ts): ukuran
// berkas dan lama proses yang tampil di kartu ringkasan serta daftar riwayat.
import test from "node:test";
import assert from "node:assert/strict";

const { lamaProses, ukuranTeks, waktuLengkap } =
  await import("../src/lib/tampilan-backup.ts");

test("ukuranTeks menulis satuan yang mudah dibaca", () => {
  assert.equal(ukuranTeks(512), "512 B");
  assert.equal(ukuranTeks(2048), "2.0 KB");
  assert.equal(ukuranTeks(1024 * 1024), "1.0 MB");
  assert.equal(ukuranTeks(1024 * 1024 * 1.5), "1.5 MB");
});

test("ukuranTeks memakai tanda pisah kalau ukurannya belum ada", () => {
  // Proses yang masih berjalan dan catatan lama belum punya ukuran.
  assert.equal(ukuranTeks(null), "—");
  assert.equal(ukuranTeks(0), "—");
});

test("lamaProses menghitung detik dan menit", () => {
  const mulai = new Date("2026-10-13T02:00:00Z");
  assert.equal(lamaProses(mulai, new Date("2026-10-13T02:00:45Z")), "45 detik");
  assert.equal(lamaProses(mulai, new Date("2026-10-13T02:01:00Z")), "1 menit");
  assert.equal(
    lamaProses(mulai, new Date("2026-10-13T02:01:12Z")),
    "1 menit 12 detik",
  );
  assert.equal(lamaProses(mulai, new Date("2026-10-13T03:00:00Z")), "60 menit");
});

test("lamaProses null selama prosesnya belum selesai", () => {
  // `selesai` kosong = baris yang masih berjalan; halaman menulisnya sendiri.
  assert.equal(lamaProses(new Date("2026-10-13T02:00:00Z"), null), null);
});

test("lamaProses tidak menampilkan waktu negatif", () => {
  // Jam server yang bergeser bisa membuat `selesai` lebih awal dari `mulai`.
  assert.equal(
    lamaProses(
      new Date("2026-10-13T02:00:00Z"),
      new Date("2026-10-13T01:59:30Z"),
    ),
    "0 detik",
  );
});

test("waktu lengkap ditulis dalam bahasa Indonesia", () => {
  assert.match(
    waktuLengkap.format(new Date("2026-10-13T09:00:00Z")),
    /^\d{1,2} \p{L}+ \d{4} pukul \d{2}\.\d{2}$/u,
  );
});
