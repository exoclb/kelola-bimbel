import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  aturPreferensi,
  beritahuLaporanBulanan,
  bersihkan,
  buatAdmin,
  buatAkun,
  buatGuru,
  buatNotifikasi,
  buatPemilik,
  buatWali,
  catatNotifikasi,
  db,
  jumlahNotifikasi,
  jumlahNotifikasiBerKunci,
  jumlahNotifikasiPesan,
  kunciLaporanBulanan,
  penerimaPemilik,
  pesanNotifikasi,
} from "./harness/notifikasi.mjs";

// Tes layanan notifikasi: siapa yang menerima, kapan sebuah peristiwa dihitung
// sekali, dan bagaimana transaksi pemanggilnya diperlakukan. Akun dan
// pembersihannya dipinjam dari `tests/harness/notifikasi.mjs`.

/**
 * Pemberitahuan operasional ditujukan ke akun pemilik/admin saja, termasuk akun
 * yang perannya ditulis sebagai daftar dipisah koma. Guru, wali, dan akun tanpa
 * peran pemilik tidak ikut.
 */
test("penerimaPemilik hanya mengembalikan akun owner/admin", async () => {
  await bersihkan();
  const owner = await buatPemilik("Owner Penerima");
  const admin = await buatAdmin("Admin Penerima");
  const keduanya = await buatAkun({
    label: "Owner Admin Penerima",
    role: "owner,admin",
  });
  const guru = await buatGuru("Guru Penerima");
  const wali = await buatWali("Wali Penerima");

  const penerima = await penerimaPemilik();
  for (const akun of [owner, admin, keduanya])
    assert.ok(penerima.includes(akun.id), `${akun.nama} seharusnya menerima`);
  assert.ok(!penerima.includes(guru.id));
  assert.ok(!penerima.includes(wali.id));
  assert.equal(
    new Set(penerima).size,
    penerima.length,
    "tidak ada yang kembar",
  );

  await bersihkan();
});

/**
 * Kunci laporan bulanan ditentukan periode, bukan waktu pengiriman: membuka
 * laporan yang sama dua kali adalah satu peristiwa, periode lain bukan.
 */
test("kunciLaporanBulanan satu per periode", () => {
  assert.equal(kunciLaporanBulanan("2097-05"), "laporan_bulanan:2097-05");
  assert.equal(kunciLaporanBulanan("2097-05"), kunciLaporanBulanan("2097-05"));
  assert.notEqual(
    kunciLaporanBulanan("2097-05"),
    kunciLaporanBulanan("2097-06"),
  );
});

/**
 * Pemicu laporan bulanan dinilai dari sisi pemilik: jenis ini bawaannya mati,
 * jadi pemilik yang belum menyalakannya tidak dikirimi; yang menyalakan
 * menerima satu baris berisi ringkasan angkanya, dan perhitungan ulang periode
 * yang sama tidak menambah baris kedua.
 *
 * Barisnya dihitung lewat kunci per periode, bukan jumlah per jenis: jenis ini
 * disiarkan ke seluruh pemilik bimbel di basis data uji, jadi jenis yang sama
 * juga memuat periode milik berkas tes lain yang berjalan bersamaan.
 */
test("beritahuLaporanBulanan sekali per periode dan hanya untuk yang menyalakannya", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Laporan");
  const pemilikBisu = await buatPemilik("Pemilik Bisu Laporan");
  const angka = {
    pemasukan: 5_000_000,
    pengeluaran: 2_150_000,
    laba: 2_850_000,
  };
  const juli = (userId) =>
    jumlahNotifikasiBerKunci(
      userId,
      "laporan_bulanan",
      "laporan_bulanan:2097-07",
    );

  await beritahuLaporanBulanan("2097-07", angka);
  assert.equal(await juli(pemilik.id), 0, "bawaan jenis ini mati");

  await aturPreferensi(pemilik.id, "laporan_bulanan", true);
  await aturPreferensi(pemilikBisu.id, "laporan_bulanan", false);

  await beritahuLaporanBulanan("2097-07", angka);
  assert.equal(await juli(pemilik.id), 1);
  assert.equal(await juli(pemilikBisu.id), 0);

  await beritahuLaporanBulanan("2097-07", angka);
  assert.equal(
    await juli(pemilik.id),
    1,
    "periode yang sama tidak memberitahu dua kali",
  );

  const [pesan] = await pesanNotifikasi(pemilik.id, "laporan_bulanan");
  assert.match(pesan, /Laporan bulan Juli 2097/);
  assert.match(pesan, /Rp5\.000\.000/);

  // Periode berikutnya adalah peristiwa baru.
  await beritahuLaporanBulanan("2097-08", angka);
  assert.equal(await juli(pemilik.id), 1);
  assert.equal(
    await jumlahNotifikasiBerKunci(
      pemilik.id,
      "laporan_bulanan",
      "laporan_bulanan:2097-08",
    ),
    1,
  );

  await bersihkan();
});

/**
 * Inti idempotensi: kunci peristiwa yang sama tidak pernah menghasilkan baris
 * kedua untuk akun yang sama, tetapi peristiwa lain tetap menghasilkan baris
 * baru. Penerima kembar dalam satu panggilan pun hanya dihitung sekali.
 */
test("buatNotifikasi menulis satu baris per peristiwa walau diulang", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Kunci");
  const owner = await buatPemilik("Owner Kunci");
  const kunci = `gaji:${guru.id}:2097-05`;
  const pesan = "Honor periode Mei 2097 sudah dibayar.";

  const pertama = await buatNotifikasi(
    "gaji_dibayar",
    pesan,
    [guru.id, owner.id, guru.id],
    kunci,
  );
  assert.equal(pertama, 2, "satu baris per penerima unik");

  const ulang = await buatNotifikasi(
    "gaji_dibayar",
    pesan,
    [guru.id, owner.id],
    kunci,
  );
  assert.equal(ulang, 0, "peristiwa yang sama tidak menambah baris");
  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 1);
  assert.equal(await jumlahNotifikasi(owner.id, "gaji_dibayar"), 1);

  const peristiwaLain = await buatNotifikasi(
    "gaji_dibayar",
    "Honor periode Juni 2097 sudah dibayar.",
    [guru.id],
    `gaji:${guru.id}:2097-06`,
  );
  assert.equal(peristiwaLain, 1, "kunci berbeda adalah peristiwa berbeda");
  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 2);

  await bersihkan();
});

/**
 * Jaminan idempotensinya ada di database, bukan di pemeriksaan aplikasi: enam
 * permintaan yang berjalan bersamaan dengan kunci peristiwa yang sama tetap
 * hanya menghasilkan satu baris per akun. Diuji serentak supaya jalur
 * `onConflictDoNothing` benar-benar dilewati, bukan cuma urutan panggilan yang
 * kebetulan berurutan.
 */
test("buatNotifikasi serentak tetap satu baris per peristiwa", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Serentak");
  const owner = await buatPemilik("Owner Serentak");
  const kunci = `rekap_honor:${guru.id}:2097-10`;
  const pesan = "Rekap honor Oktober 2097 sudah tersedia.";

  const hasil = await Promise.all(
    Array.from({ length: 6 }, () =>
      buatNotifikasi("rekap_honor", pesan, [guru.id, owner.id], kunci),
    ),
  );
  assert.equal(
    hasil.reduce((total, jumlah) => total + jumlah, 0),
    2,
    "dua penerima, sekali saja walau dipicu bersamaan",
  );
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(owner.id, "rekap_honor"), 1);
  assert.equal(
    await jumlahNotifikasiBerKunci(guru.id, "rekap_honor", kunci),
    1,
    "hanya satu baris memakai kunci peristiwa itu",
  );

  await bersihkan();
});

/**
 * Preferensi akun tetap berlaku di jalur idempoten: jenis yang dimatikan tidak
 * menerima baris, dan penerima yang ditahan tidak dihitung sebagai dibuat.
 */
test("buatNotifikasi menghormati preferensi akun yang mematikan jenisnya", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Preferensi");
  const owner = await buatPemilik("Owner Preferensi");
  await aturPreferensi(owner.id, "rekap_honor", false);

  const dibuat = await buatNotifikasi(
    "rekap_honor",
    "Rekap honor Mei 2097 sudah tersedia.",
    [guru.id, owner.id],
    `honor:${guru.id}:2097-05`,
  );
  assert.equal(dibuat, 1);
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(owner.id, "rekap_honor"), 0);

  await bersihkan();
});

/**
 * Penerima yang ditahan tidak memakai kunci peristiwanya: barisnya memang tidak
 * pernah ditulis, jadi peristiwa yang dipicu ulang setelah preferensinya
 * menyala tetap sampai — tepat satu baris. Ini yang membuat pemberitahuan tidak
 * hilang hanya karena jenisnya baru dinyalakan setelah peristiwanya terjadi,
 * mis. laporan bulanan yang halamannya boleh dihitung berkali-kali.
 */
test("kunci peristiwa baru terpakai setelah preferensinya dinyalakan", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Preferensi Menyala");
  const kunci = `honor:${guru.id}:2097-07`;
  const pesan = "Rekap honor Juli 2097 sudah tersedia.";

  await aturPreferensi(guru.id, "rekap_honor", false);
  assert.equal(
    await buatNotifikasi("rekap_honor", pesan, [guru.id], kunci),
    0,
    "tidak ada baris selama preferensinya mati",
  );
  assert.equal(
    await jumlahNotifikasiBerKunci(guru.id, "rekap_honor", kunci),
    0,
  );

  await aturPreferensi(guru.id, "rekap_honor", true);
  assert.equal(
    await buatNotifikasi("rekap_honor", pesan, [guru.id], kunci),
    1,
    "peristiwa yang sama terkirim setelah dinyalakan",
  );
  assert.equal(
    await buatNotifikasi("rekap_honor", pesan, [guru.id], kunci),
    0,
    "dan tetap sekali saja",
  );

  await bersihkan();
});

/**
 * Akun yang hilang di antara penghitungan penerima dan penulisan baris tidak
 * boleh menggagalkan penulisannya: daftar penerima dihitung dari akun yang bisa
 * dihapus kapan saja (`penerimaPemilik`), dan pelanggaran kunci asing di situ
 * membatalkan transaksi pemanggilnya — mis. simpan jurnal yang sedang dikirim
 * guru. Penerima yang sudah tidak ada cukup dilewati.
 */
test("buatNotifikasi melewati penerima yang akunnya sudah tidak ada", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Penerima Hilang");
  const akunHilang = randomUUID();

  const dibuat = await buatNotifikasi(
    "rekap_honor",
    "Rekap honor Mei 2097 sudah tersedia.",
    [guru.id, akunHilang],
    `honor:${guru.id}:2097-05`,
  );
  assert.equal(dibuat, 1, "hanya penerima yang masih ada yang ditulis");
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);

  await bersihkan();
});

/**
 * Pemicu ikut transaksi pemanggilnya: transaksi yang dibatalkan tidak
 * meninggalkan notifikasi, dan pemanggilan ulang di dalam satu transaksi tetap
 * hanya satu baris.
 */
test("buatNotifikasi mengikuti transaksi pemanggilnya", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Transaksi");
  const kunci = `jurnal:${randomUUID()}`;

  await assert.rejects(
    db.transaction(async (tx) => {
      await buatNotifikasi(
        "jurnal_baru",
        "Jurnal masuk.",
        [guru.id],
        kunci,
        tx,
      );
      throw new Error("transaksi dibatalkan");
    }),
    /transaksi dibatalkan/,
  );
  assert.equal(await jumlahNotifikasi(guru.id, "jurnal_baru"), 0);

  await db.transaction(async (tx) => {
    await buatNotifikasi("jurnal_baru", "Jurnal masuk.", [guru.id], kunci, tx);
    await buatNotifikasi("jurnal_baru", "Jurnal masuk.", [guru.id], kunci, tx);
  });
  assert.equal(await jumlahNotifikasi(guru.id, "jurnal_baru"), 1);

  await bersihkan();
});

/**
 * Jalur tanpa kunci peristiwa (dipakai pemicu jurnal) juga boleh ikut
 * transaksi pemanggilnya: kabar untuk jurnal yang gagal disimpan tidak boleh
 * tertinggal sebagai notifikasi untuk peristiwa yang tidak pernah terjadi.
 * Tanpa kunci, tiap panggilan tetap satu baris — penjaga "peristiwanya sudah
 * pernah dikabarkan?" milik pemanggilnya, bukan milik kolom `kunci`.
 *
 * Barisnya dihitung dari pesan yang khas milik tes ini: jenis `jurnal_baru`
 * disiarkan ke seluruh pemilik bimbel, jadi berkas tes lain yang berjalan
 * bersamaan juga menambah baris jenis yang sama untuk akun pemilik di sini.
 */
test("catatNotifikasi mengikuti transaksi pemanggilnya", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Catat Transaksi");
  const pesan = "Jurnal masuk (uji transaksi catat).";
  const jumlah = () => jumlahNotifikasiPesan(pemilik.id, "jurnal_baru", pesan);

  await assert.rejects(
    db.transaction(async (tx) => {
      await catatNotifikasi("jurnal_baru", pesan, [pemilik.id], tx);
      throw new Error("transaksi dibatalkan");
    }),
    /transaksi dibatalkan/,
  );
  assert.equal(await jumlah(), 0);

  await db.transaction(async (tx) => {
    await catatNotifikasi("jurnal_baru", pesan, [pemilik.id], tx);
    await catatNotifikasi("jurnal_baru", pesan, [pemilik.id], tx);
  });
  assert.equal(await jumlah(), 2, "tanpa kunci, tiap panggilan satu baris");

  await bersihkan();
});

/**
 * Kunci peristiwa berlaku per akun, bukan global: akun yang sudah menerima
 * sebuah peristiwa tidak menahan akun lain yang belum menerimanya — termasuk
 * saat keduanya ditulis dalam satu perintah sisip. Kalau tidak begitu, satu
 * baris lama milik akun lain akan menelan baris penerima baru, dan orang yang
 * baru bergabung tidak pernah menerima kabar peristiwanya.
 */
test("kunci peristiwa yang sudah dipakai satu akun tidak menahan akun lain", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Kunci Sebagian");
  const admin = await buatAdmin("Admin Kunci Sebagian");
  const kunci = `rekap_honor:${guru.id}:2097-09`;
  const pesan = "Rekap honor September 2097 sudah tersedia.";

  // Guru sudah menerima peristiwa ini lewat panggilan sebelumnya.
  assert.equal(await buatNotifikasi("rekap_honor", pesan, [guru.id], kunci), 1);

  // Panggilan berikutnya menyertakan admin yang belum menerimanya: baris guru
  // dilewati, baris admin tetap ditulis dalam perintah yang sama.
  assert.equal(
    await buatNotifikasi("rekap_honor", pesan, [guru.id, admin.id], kunci),
    1,
    "hanya penerima yang belum punya baris yang ditulis",
  );
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(admin.id, "rekap_honor"), 1);

  await bersihkan();
});

/**
 * Kunci peristiwa harus benar-benar berisi. Kunci kosong bukan "tanpa kunci"
 * (yang memang boleh dan selalu menulis baris baru): `''` adalah nilai biasa
 * bagi indeks unik, jadi seluruh peristiwa bertipe sama akan dianggap satu
 * peristiwa dan notifikasinya hilang diam-diam. Database menolaknya lebih dulu
 * supaya salah pakai terlihat sebagai galat, bukan sebagai kabar yang tidak
 * pernah sampai.
 */
test("buatNotifikasi menolak kunci peristiwa yang kosong", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Kunci Kosong");

  for (const kunci of ["", "   "]) {
    // Drizzle membungkus galat pg-nya, jadi kodenya dibaca dari `cause`.
    await assert.rejects(
      () => buatNotifikasi("rekap_honor", "Honor 2097", [guru.id], kunci),
      (galat) => (galat.cause?.code ?? galat.code) === "23514",
      `kunci ${JSON.stringify(kunci)} ditolak database`,
    );
  }
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 0);

  await bersihkan();
});
