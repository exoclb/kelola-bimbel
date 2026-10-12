// Uji pembantu tampilan modul backup (src/lib/tampilan-backup.ts): ukuran
// berkas, lama proses, umur, dan kesegaran salinan yang tampil di kartu
// ringkasan serta daftar riwayat.
import test from "node:test";
import assert from "node:assert/strict";

const { kesegaranBackup, lamaProses, ukuranTeks, umurBackup, waktuLengkap } =
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

test("umurBackup menulis umur salinan dalam bahasa sehari-hari", () => {
  const sekarang = new Date("2026-10-13T03:00:00Z");
  assert.equal(
    umurBackup(new Date("2026-10-13T02:00:00Z"), sekarang),
    "hari ini",
  );
  assert.equal(
    umurBackup(new Date("2026-10-12T02:00:00Z"), sekarang),
    "kemarin",
  );
  assert.equal(
    umurBackup(new Date("2026-10-10T02:00:00Z"), sekarang),
    "3 hari lalu",
  );
  // Jam server yang bergeser: waktu di masa depan bukan "besok" yang aneh.
  assert.equal(
    umurBackup(new Date("2026-10-13T09:00:00Z"), sekarang),
    "hari ini",
  );
});

test("kesegaranBackup menilai salinan terhadap jadwal harian", () => {
  const sekarang = new Date("2026-10-13T03:00:00Z");
  const jadwal = { jedaJam: 24, retensiHari: 30 };

  // Baru satu jam lalu: masih dalam tenggang jadwal.
  const segar = kesegaranBackup(
    new Date("2026-10-13T02:00:00Z"),
    jadwal,
    sekarang,
  );
  assert.equal(segar.tingkat, "segar");
  assert.equal(segar.label, "Sesuai jadwal");

  // Tenggang dua jam: backup yang mulai telat belum dicap terlambat.
  assert.equal(
    kesegaranBackup(new Date("2026-10-12T01:00:00Z"), jadwal, sekarang).tingkat,
    "segar",
  );
  assert.equal(
    kesegaranBackup(new Date("2026-10-12T00:59:59Z"), jadwal, sekarang).tingkat,
    "terlambat",
  );
  const terlambat = kesegaranBackup(
    new Date("2026-10-10T02:00:00Z"),
    jadwal,
    sekarang,
  );
  assert.equal(terlambat.label, "Terlambat");

  // Salinan yang lebih tua dari retensi mungkin sudah dihapus penjadwal.
  const kadaluarsa = kesegaranBackup(
    new Date("2026-09-01T02:00:00Z"),
    jadwal,
    sekarang,
  );
  assert.equal(kadaluarsa.tingkat, "kadaluarsa");
  assert.equal(kadaluarsa.label, "Lewat retensi");
  assert.match(kadaluarsa.keterangan, /retensi 30 hari/);

  // Ketiga keadaan selalu membawa penjelasan yang bisa dibaca pengguna.
  for (const hasil of [segar, terlambat, kadaluarsa])
    assert.ok(hasil.keterangan.length >= 40, hasil.keterangan);

  // Retensi yang lebih pendek membuat salinan tua langsung lewat batas.
  assert.equal(
    kesegaranBackup(
      new Date("2026-10-10T02:00:00Z"),
      {
        jedaJam: 24,
        retensiHari: 1,
      },
      sekarang,
    ).tingkat,
    "kadaluarsa",
  );
});
