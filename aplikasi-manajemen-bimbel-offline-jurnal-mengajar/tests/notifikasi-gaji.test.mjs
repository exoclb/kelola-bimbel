import test from "node:test";
import assert from "node:assert/strict";
import {
  aturPreferensi,
  bersihkan,
  buatGuru,
  jumlahNotifikasi,
  pesanNotifikasi,
  picuRekapHonor,
} from "./harness/notifikasi.mjs";

// Tes pemicu honor: `tandaiPembayaranGaji` (dipanggil lewat `picuRekapHonor`)
// mencatat rekap periode, lalu mengabari gurunya. Akun, koneksi, dan
// pembersihannya dari `tests/harness/notifikasi.mjs`.

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
