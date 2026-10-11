import test from "node:test";
import assert from "node:assert/strict";
import {
  aturPreferensi,
  bersihkan,
  buatAdmin,
  buatGuru,
  buatKelas,
  buatPemilik,
  jumlahNotifikasi,
  pesanNotifikasi,
  picuRekapHonor,
  pool,
} from "./harness/notifikasi.mjs";

// Tes pemicu honor: `tandaiPembayaranGaji` (dipanggil lewat `picuRekapHonor`)
// mencatat rekap periode, lalu mengabari gurunya. Akun, koneksi, dan
// pembersihannya dari `tests/harness/notifikasi.mjs`.
//
// Hanya berkas ini yang memakai tarif bertanggal `2099-08-01` dan menulis
// jurnalnya sendiri, jadi angka di kabar honornya bisa dipastikan.
const PERIODE_ANGKA = "2099-08";
const TARIF_ANGKA = "2099-08-01";

/** Hapus hanya baris `salary_settings` milik berkas ini. */
async function bersihkanTarif() {
  await pool.query("DELETE FROM salary_settings WHERE berlaku_sejak = $1", [
    TARIF_ANGKA,
  ]);
}

/** Satu aturan tarif uji untuk perhitungan honor di `PERIODE_ANGKA`. */
async function aturTarif(tarifPerJam) {
  await pool.query(
    `INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak)
     VALUES ($1, 'per jam', $2)
     ON CONFLICT (berlaku_sejak) DO UPDATE SET tarif_per_jam = $1`,
    [tarifPerJam, TARIF_ANGKA],
  );
}

/** Jurnal satu sesi mengajar; ditulis langsung supaya tanggalnya bisa dipilih. */
async function jurnal(guruId, classId, tanggal, jamMengajar, materi) {
  await pool.query(
    `INSERT INTO teaching_journals (guru_id, class_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, $3, $4, $5)`,
    [guruId, classId, tanggal, materi, jamMengajar],
  );
}

/**
 * Pemicu honor: begitu rekap satu periode dicatat untuk guru, gurunya menerima
 * satu notifikasi `rekap_honor`; menandai ulang bulan yang sama tidak menambah
 * baris kedua, sedangkan bulan lain tetap memberitahu sekali lagi.
 */
test("rekap honor periodik hanya memberi tahu sekali per periode", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Rekap Honor");

  const pertama = await picuRekapHonor({ guruId: guru.id, periode: "2097-07" });
  assert.equal(pertama.status, "tersimpan");
  const kedua = await picuRekapHonor({ guruId: guru.id, periode: "2097-07" });
  assert.equal(kedua.status, "tersimpan");

  const pesanJuli = await pesanNotifikasi(guru.id, "rekap_honor");
  assert.equal(pesanJuli.length, 1, "satu peristiwa, satu notifikasi");
  assert.match(pesanJuli[0], /Juli 2097/);

  await picuRekapHonor({ guruId: guru.id, periode: "2097-08" });
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 2);

  await bersihkan();
});

/**
 * Preferensi tetap berlaku untuk pemicu honor: guru yang mematikan jenis
 * `rekap_honor` tidak menerima notifikasi rekapnya, sementara jenis lain
 * (`gaji_dibayar`) tetap sampai karena preferensinya per jenis.
 */
test("guru yang mematikan rekap_honor tidak dikirimi", async () => {
  await bersihkan();
  const mematikan = await buatGuru("Guru Tanpa Rekap Honor");
  const memakai = await buatGuru("Guru Dengan Rekap Honor");
  await aturPreferensi(mematikan.id, "rekap_honor", false);

  await picuRekapHonor({
    guruId: mematikan.id,
    periode: "2097-10",
    dibayar: true,
  });
  await picuRekapHonor({
    guruId: memakai.id,
    periode: "2097-10",
    dibayar: true,
  });

  assert.equal(await jumlahNotifikasi(mematikan.id, "rekap_honor"), 0);
  assert.equal(await jumlahNotifikasi(mematikan.id, "gaji_dibayar"), 1);
  assert.equal(await jumlahNotifikasi(memakai.id, "rekap_honor"), 1);

  await bersihkan();
});

/**
 * Dua jenis notifikasi honor tetap terpisah: `rekap_honor` saat rekapitulasi
 * pertama dicatat, dan `gaji_dibayar` saat pembayarannya ditandai — masing-
 * masing sekali per guru + periode walau aksinya diulang.
 */
test("tandai dibayar menambah notifikasi gaji sekali saja", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Honor Dibayar");

  await picuRekapHonor({
    guruId: guru.id,
    periode: "2097-09",
    dibayar: true,
  });
  await picuRekapHonor({
    guruId: guru.id,
    periode: "2097-09",
    dibayar: true,
  });

  const pesanRekap = await pesanNotifikasi(guru.id, "rekap_honor");
  const pesanGaji = await pesanNotifikasi(guru.id, "gaji_dibayar");
  assert.equal(pesanRekap.length, 1);
  assert.equal(pesanGaji.length, 1);
  assert.match(pesanGaji[0], /September 2097/);

  await bersihkan();
});

/**
 * Sasaran kabar rekap honor adalah gurunya sendiri: guru lain, pemilik, dan
 * admin yang mencatat rekapitulasi itu tidak ikut dikirimi. Kabar ke pemilik
 * hanya untuk laporan bulanan, jadi pemicu honor memakai daftar penerima yang
 * berisi satu akun saja.
 */
test("kabar rekap honor hanya untuk guru yang direkap", async () => {
  await bersihkan();
  const direkap = await buatGuru("Guru Punya Rekap");
  const lain = await buatGuru("Guru Lain Rekap");
  const pemilik = await buatPemilik("Pemilik Rekap Honor");
  const admin = await buatAdmin("Admin Rekap Honor");

  await picuRekapHonor({ guruId: direkap.id, periode: "2097-11" });

  assert.equal(await jumlahNotifikasi(direkap.id, "rekap_honor"), 1);
  for (const akun of [lain, pemilik, admin]) {
    assert.equal(
      await jumlahNotifikasi(akun.id, "rekap_honor"),
      0,
      `${akun.nama} bukan penerima kabar rekap guru lain`,
    );
  }

  await bersihkan();
});

/**
 * Angka di kabar rekap adalah angka periode itu: jam dari jurnal yang tanggalnya
 * jatuh di dalam bulan tersebut, dan totalnya hasil perkaliannya dengan tarif
 * yang berlaku — bukan angka bulan lain. Salinan yang tersimpan di
 * `salary_recaps` dan kalimat yang dikirim harus sama, kalau tidak guru membaca
 * honor yang bukan honornya.
 */
test("kabar rekap honor memuat jam dan total periode itu", async () => {
  await bersihkan();
  await bersihkanTarif();
  const guru = await buatGuru("Guru Rekap Berangka");
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Rekap Berangka",
    denganJadwal: false,
  });
  await jurnal(guru.id, kelas.id, `${PERIODE_ANGKA}-05`, 1.5, "Aljabar");
  await jurnal(guru.id, kelas.id, `${PERIODE_ANGKA}-19`, 2, "Geometri");
  // Jurnal bulan berikutnya tidak boleh ikut terhitung di periode ini.
  await jurnal(guru.id, kelas.id, "2099-09-02", 5, "Trigonometri");
  await aturTarif(40_000);

  await picuRekapHonor({ guruId: guru.id, periode: PERIODE_ANGKA });

  const { rows } = await pool.query(
    "SELECT total_jam, total_gaji FROM salary_recaps WHERE guru_id = $1 AND periode_bulan = $2",
    [guru.id, PERIODE_ANGKA],
  );
  assert.equal(Number(rows[0].total_jam), 3.5);
  assert.equal(Number(rows[0].total_gaji), 140_000);

  const pesan = await pesanNotifikasi(guru.id, "rekap_honor");
  assert.equal(pesan.length, 1);
  assert.match(pesan[0], /periode Agustus 2099/);
  assert.match(pesan[0], /Total Rp140\.000 dari 3,5 jam mengajar/);

  // Rekap pertama juga menandai statusnya belum dibayar, jadi belum ada kabar
  // pelunasan.
  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 0);

  await bersihkanTarif();
  await bersihkan();
});

/**
 * Membatalkan pembayaran lalu menandainya lunas lagi tidak menghasilkan kabar
 * kedua: kuncinya per guru + periode, jadi riwayat pembayaran yang bolak-balik
 * tetap satu pemberitahuan per periode.
 */
test("menandai bayar ulang setelah dibatalkan tetap satu kabar", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Bayar Bolak Balik");

  await picuRekapHonor({ guruId: guru.id, periode: "2097-12", dibayar: true });
  await picuRekapHonor({ guruId: guru.id, periode: "2097-12", dibayar: false });
  await picuRekapHonor({ guruId: guru.id, periode: "2097-12", dibayar: true });

  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 1);
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);

  await bersihkan();
});

/**
 * Arah sebaliknya dari preferensi honor: guru yang hanya mematikan
 * `gaji_dibayar` tetap menerima kabar rekapnya, dan pembayarannya tetap
 * tercatat — yang ditahan hanya pemberitahuannya, bukan pencatatan honornya.
 * Penerima yang ditahan juga tidak dihitung sebagai baris yang dibuat.
 */
test("guru yang mematikan gaji_dibayar tidak dikirimi kabar pelunasan", async () => {
  await bersihkan();
  const mematikan = await buatGuru("Guru Tanpa Kabar Gaji");
  const memakai = await buatGuru("Guru Dengan Kabar Gaji");
  await aturPreferensi(mematikan.id, "gaji_dibayar", false);

  const hasil = await picuRekapHonor({
    guruId: mematikan.id,
    periode: "2098-04",
    dibayar: true,
  });
  await picuRekapHonor({
    guruId: memakai.id,
    periode: "2098-04",
    dibayar: true,
  });

  assert.equal(hasil.status, "tersimpan");
  assert.equal(
    hasil.pembayaran.statusPembayaran,
    "dibayar",
    "pembayarannya tetap tercatat walau kabarnya ditahan",
  );
  assert.notEqual(hasil.pembayaran.tanggalDibayar, null);

  assert.equal(await jumlahNotifikasi(mematikan.id, "gaji_dibayar"), 0);
  assert.equal(await jumlahNotifikasi(mematikan.id, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(memakai.id, "gaji_dibayar"), 1);

  await bersihkan();
});
