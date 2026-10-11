import test from "node:test";
import assert from "node:assert/strict";
import {
  aturPreferensi,
  bersihkan,
  buatGuru,
  buatMurid,
  buatNotifikasi,
  buatPemilik,
  buatWali,
  jumlahNotifikasi,
  jumlahNotifikasiBerKunci,
  kunciLaporanBulanan,
  picuLaporanBulanan,
  picuRekapHonor,
  picuTagihan,
  picuUbahTagihan,
  pool,
  tautkanWali,
} from "./harness/notifikasi.mjs";

// Tes anti-duplikat untuk aksi pemicu yang datang bersamaan. Berkas tes lain
// sudah menguji aksi yang diulang berurutan (jurnal, honor, tagihan, laporan);
// yang dikunci di sini justru kiriman yang berjalan serentak — dua perangkat
// menekan tombol yang sama pada saat yang hampir bersamaan. Penjaganya bukan
// pemeriksaan "sudah ada?" di aplikasi, melainkan indeks unik
// `notifications_user_tipe_kunci_idx` yang ditulis lewat `onConflictDoNothing`,
// jadi hasilnya tetap satu baris walau kedua permintaan sama-sama lolos
// pemeriksaan awal.
//
// Angka yang diperiksa sengaja "tepat satu" dan bukan "tidak menambah": hasil
// ini tidak bergantung pada urutan kedua permintaan, sebab bagaimanapun
// jadwalnya hanya satu baris yang boleh lahir dari satu kunci.
//
// Periode ujinya (2096-xx) tidak dipakai berkas tes lain supaya kunci laporan
// bulanan — jenis yang disiarkan ke seluruh pemilik bimbel — tidak bertabrakan
// dengan proses lain yang berjalan bersamaan.

/** Id tagihan satu murid pada satu periode, dibaca dari tabelnya langsung. */
async function tagihanId(muridId, periode) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const { rows } = await pool.query(
    "SELECT id FROM student_invoices WHERE student_id = $1 AND periode_bulan = $2 AND periode_tahun = $3",
    [muridId, bulan, tahun],
  );
  return rows[0]?.id;
}

/** Jumlah baris tagihan satu murid pada satu periode. */
async function jumlahTagihan(muridId, periode) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const { rows } = await pool.query(
    "SELECT count(*)::int AS jumlah FROM student_invoices WHERE student_id = $1 AND periode_bulan = $2 AND periode_tahun = $3",
    [muridId, bulan, tahun],
  );
  return rows[0].jumlah;
}

/**
 * Lapisan paling dasar: lima penulisan untuk satu kunci yang sama dijalankan
 * serentak. Hanya satu yang benar-benar menulis barisnya — sisanya dilewati
 * indeks unik tanpa galat, dan jumlah baris yang dilaporkan penulisnya ikut
 * dihitung supaya pemanggil yang menggantungkan diri pada angka itu (mis.
 * "berapa kabar yang terkirim") tidak pernah melihat angka lebih dari satu.
 */
test("penulisan bersamaan untuk satu peristiwa tetap satu baris", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Tulis Bersamaan");
  const kunci = `rekap_honor:${guru.id}:2096-05`;

  const dibuat = await Promise.all(
    Array.from({ length: 5 }, () =>
      buatNotifikasi("rekap_honor", "Rekap honor 2096-05.", [guru.id], kunci),
    ),
  );

  assert.equal(
    dibuat.reduce((jumlah, baris) => jumlah + baris, 0),
    1,
    "hanya satu permintaan yang benar-benar menulis barisnya",
  );
  assert.equal(
    await jumlahNotifikasiBerKunci(guru.id, "rekap_honor", kunci),
    1,
  );

  await bersihkan();
});

/**
 * Pemicu honor yang berjalan serentak: dua rekap periode yang sama dicatat pada
 * saat yang hampir bersamaan. Tiap jenisnya punya kuncinya sendiri
 * (`rekap_honor:<guruId>:<periode>` dan `gaji_dibayar:<guruId>:<periode>`),
 * jadi gurunya tetap menerima tepat satu kabar per jenis.
 */
test("rekap honor yang dipicu bersamaan mengabari sekali per jenis", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Rekap Bersamaan");

  await Promise.all([
    picuRekapHonor({ guruId: guru.id, periode: "2096-06", dibayar: true }),
    picuRekapHonor({ guruId: guru.id, periode: "2096-06", dibayar: true }),
  ]);

  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 1);
  assert.equal(await jumlahNotifikasi(guru.id, "gaji_dibayar"), 1);

  await bersihkan();
});

/**
 * Penerbitan tagihan SPP untuk periode yang sama dua kali sekaligus: indeks
 * unik (murid + periode) yang melewatkan tagihan keduanya, dan hanya tagihan
 * yang benar-benar terbit yang mengabari walinya. Anaknya tetap punya satu
 * tagihan, walinya tetap satu kabar.
 */
test("tagihan yang diterbitkan bersamaan tetap satu tagihan dan satu kabar", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Tagihan Bersamaan");
  const murid = await buatMurid({ label: "Murid Tagihan Bersamaan" });
  await tautkanWali(wali.id, murid.id);

  const hasil = await Promise.all([
    picuTagihan({ muridIds: [murid.id], periode: "2096-07" }),
    picuTagihan({ muridIds: [murid.id], periode: "2096-07" }),
  ]);

  assert.equal(
    hasil[0].dibuat + hasil[1].dibuat,
    1,
    "hanya satu permintaan yang menerbitkan tagihannya",
  );
  assert.equal(await jumlahTagihan(murid.id, "2096-07"), 1);
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 1);

  await bersihkan();
});

/**
 * Menandai tagihan yang sama lunas dua kali sekaligus. Kuncinya
 * `tagihan:<idTagihan>:lunas` — terpisah dari kabar penerbitannya — jadi
 * walinya menerima satu kabar terbit dan satu kabar lunas, tidak lebih.
 */
test("tagihan yang ditandai lunas bersamaan mengabari sekali", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Lunas Bersamaan");
  const murid = await buatMurid({ label: "Murid Lunas Bersamaan" });
  await tautkanWali(wali.id, murid.id);
  await picuTagihan({ muridIds: [murid.id], periode: "2096-08" });
  const id = await tagihanId(murid.id, "2096-08");

  await Promise.all([
    picuUbahTagihan(id, { status: "lunas" }),
    picuUbahTagihan(id, { status: "lunas" }),
  ]);

  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_lunas"), 1);
  assert.equal(await jumlahNotifikasi(wali.id, "tagihan_terbit"), 1);

  await bersihkan();
});

/**
 * Preferensi menahan sebelum kuncinya terpakai. Pemicu yang sama dijalankan
 * serentak saat jenisnya dimatikan: tidak ada satu baris pun yang ditulis, dan
 * tidak ada galat walau keduanya sama-sama lolos pemeriksaan awal. Angka nol
 * itu yang benar — bukan "satu baris ditandai dilewati" — sebab yang menahan
 * memang penyaringan penerima, bukan indeks uniknya.
 */
test("pemicu bersamaan saat jenisnya dimatikan tidak menulis apa pun", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Serentak Dimatikan");
  const kunci = `rekap_honor:${guru.id}:2096-10`;
  await aturPreferensi(guru.id, "rekap_honor", false);

  const hasil = await Promise.all([
    picuRekapHonor({ guruId: guru.id, periode: "2096-10" }),
    picuRekapHonor({ guruId: guru.id, periode: "2096-10" }),
  ]);

  assert.deepEqual(
    hasil.map((baris) => baris.status),
    ["tersimpan", "tersimpan"],
    "penahanannya bukan galat",
  );
  assert.equal(await jumlahNotifikasi(guru.id, "rekap_honor"), 0);
  assert.equal(
    await jumlahNotifikasiBerKunci(guru.id, "rekap_honor", kunci),
    0,
  );

  await bersihkan();
});

/**
 * Laporan bulanan — satu-satunya jenis yang disiarkan ke seluruh pemilik —
 * dihitung ulang untuk periode yang sama pada saat yang hampir bersamaan.
 * Kuncinya `laporan_bulanan:<periode>` tanpa id akun, jadi yang diperiksa
 * jumlah baris per kunci milik pemilik uji, bukan jumlah per jenisnya.
 */
test("laporan bulanan yang dihitung ulang bersamaan tetap satu kabar", async () => {
  await bersihkan();
  const pemilik = await buatPemilik("Pemilik Laporan Bersamaan");
  await aturPreferensi(pemilik.id, "laporan_bulanan", true);

  await Promise.all([
    picuLaporanBulanan({ periode: "2096-09" }),
    picuLaporanBulanan({ periode: "2096-09" }),
  ]);

  assert.equal(
    await jumlahNotifikasiBerKunci(
      pemilik.id,
      "laporan_bulanan",
      kunciLaporanBulanan("2096-09"),
    ),
    1,
  );

  await bersihkan();
});
