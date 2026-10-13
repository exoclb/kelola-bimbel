// Uji bentuk ringkasan CI otomatis (src/lib/ci-otomatis.ts): urutan langkah
// baku, keadaan langkah yang belum jalan, hitungannya, pemilihan jalan terakhir
// yang selesai, dan kalimat ringkasannya. Data contoh di
// src/lib/mock-ci-otomatis.ts ikut diperiksa supaya bentuk halaman Status CI
// tidak melenceng.
//
// Alias "@/..." milik tsconfig diterjemahkan penerjemah bersama di
// tests/dukungan/impor-ts.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

pasangImporTs();

const {
  PEMERIKSAAN_CI,
  SARAN_KEGAGALAN_CI,
  barisPemeriksaanCi,
  ciSedangBerjalan,
  definisiPemeriksaan,
  hitungPemeriksaanCi,
  jalanTerakhirSelesai,
  jalanTerbaru,
  lamaDetik,
  pemeriksaanGagalCi,
  rincianKegagalanCi,
  ringkasJalanCi,
  saranPerbaikan,
} = await import("../src/lib/ci-otomatis.ts");
const {
  DETIK_BERJALAN_TIRUAN,
  getJalanCiBerjalan,
  getRiwayatCi,
  logKegagalanTiruan,
} = await import("../src/lib/mock-ci-otomatis.ts");

/** Satu jalan CI lengkap; tiap tes menimpanya seperlunya. */
function jalan(ubah = {}) {
  return {
    id: "ci-1",
    commit: "abcdef1",
    pesanCommit: "feat: contoh",
    cabang: "main",
    mulai: new Date("2026-10-13T09:41:00+07:00"),
    selesai: new Date("2026-10-13T09:46:00+07:00"),
    status: "lulus",
    pemeriksaan: [],
    ...ubah,
  };
}

/** Hasil satu langkah baku. */
function hasil(kunci, status, durasiDetik = 30, catatan = null) {
  return { kunci, status, durasiDetik, catatan };
}

test("langkah baku pipa CI mengikuti urutan berkas ci.yml", () => {
  assert.deepEqual(
    PEMERIKSAAN_CI.map((item) => item.kunci),
    ["penyiapan", "pemeriksaan-kode", "format", "build", "uji-end-to-end"],
  );
  for (const item of PEMERIKSAAN_CI) {
    assert.ok(item.nama.length > 0, `${item.kunci} punya nama`);
    assert.ok(
      item.perintah.startsWith("npm run "),
      `${item.kunci} punya perintah`,
    );
    assert.ok(item.keterangan.length > 10, `${item.kunci} punya keterangan`);
  }
});

const akarRepo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const berkasRepo = (jalur) => readFileSync(resolve(akarRepo, jalur), "utf8");

/** Nomor baris pertama yang memuat teksnya, atau -1 kalau tidak ada. */
function nomorBaris(isi, teks) {
  return isi.split("\n").findIndex((baris) => baris.includes(teks));
}

/** Baris-baris di dalam blok `on:` (pemicu pipa), tanpa baris kuncinya. */
function blokPemicu(isi) {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((satu) => /^on:\s*$/.test(satu));
  if (mulai < 0) return [];
  const akhir = baris.findIndex(
    (satu, indeks) => indeks > mulai && /^[^#\s]/.test(satu),
  );
  return baris.slice(mulai + 1, akhir < 0 ? undefined : akhir);
}

/** Baris-baris di dalam satu job (dari `  nama:` sampai job berikutnya). */
function blokJob(isi, nama) {
  const baris = isi.split("\n");
  const mulai = baris.findIndex((satu) => satu === `  ${nama}:`);
  if (mulai < 0) return null;
  const akhir = baris.findIndex(
    (satu, indeks) => indeks > mulai && /^ {2}\S/.test(satu),
  );
  return baris.slice(mulai + 1, akhir < 0 ? undefined : akhir);
}

// Berkas pipanya sungguhan, bukan cuma daftar di atas kertas: uji ini membaca
// `.github/workflows/ci.yml` supaya langkah yang dijanjikan halaman Status CI
// tidak bisa menghilang diam-diam dari pipa yang benar-benar dijalankan.
test("berkas ci.yml menjalankan langkah baku itu berurutan", () => {
  const isi = berkasRepo(".github/workflows/ci.yml");

  let sebelumnya = -1;
  for (const langkah of PEMERIKSAAN_CI) {
    const posisi = nomorBaris(isi, `run: ${langkah.perintah}`);
    assert.ok(posisi >= 0, `ci.yml menjalankan ${langkah.perintah}`);
    assert.ok(
      posisi > sebelumnya,
      `${langkah.perintah} dijalankan setelah langkah sebelumnya`,
    );
    sebelumnya = posisi;
  }
});

test("berkas ci.yml dipicu push dan pull request dengan pengamanannya", () => {
  const isi = berkasRepo(".github/workflows/ci.yml");
  const pemicu = blokPemicu(isi);

  // Pemicunya sama dengan yang disebut halaman Status CI: setiap push dan PR.
  assert.deepEqual(
    pemicu
      .filter((satu) => /^\s{2}[a-z_]+:\s*$/.test(satu))
      .map((satu) => satu.trim()),
    ["push:", "pull_request:"],
  );
  // Hanya membaca isi repositori; tidak ada rahasia yang perlu ditulis.
  assert.match(isi, /^permissions:\n  contents: read$/m);
  // Versi Node mengikuti .nvmrc, sama seperti yang disarankan saran kegagalan
  // langkah penyiapan di src/lib/ci-otomatis.ts.
  assert.ok(nomorBaris(isi, "node-version-file: .nvmrc") > 0);
  // Hasil uji peramban diunggah setelah ujinya jalan, dan disimpan 7 hari
  // seperti yang dijanjikan halaman Status CI.
  assert.ok(
    nomorBaris(isi, "path: test-results/") >
      nomorBaris(isi, "run: npm run test:e2e"),
  );
  assert.ok(nomorBaris(isi, "if: failure()") > 0);
  assert.ok(nomorBaris(isi, "retention-days: 7") > 0);
});

test("berkas ci.yml memisahkan uji peramban ke jobnya sendiri", () => {
  const isi = berkasRepo(".github/workflows/ci.yml");
  const pemeriksaan = blokJob(isi, "check");
  const peramban = blokJob(isi, "e2e");

  assert.ok(pemeriksaan, "ci.yml punya job check");
  assert.ok(peramban, "ci.yml punya job e2e");
  // Job peramban menunggu pemeriksaan kode lulus, jadi yang gagal murah tidak
  // menahan runner sampai selesai memasang peramban.
  assert.ok(peramban.some((satu) => satu.trim() === "needs: check"));
  assert.ok(!pemeriksaan.some((satu) => satu.includes("playwright")));
  // Tiap job berjalan di mesin baru, jadi keduanya menyiapkan sendiri.
  for (const blok of [pemeriksaan, peramban]) {
    assert.ok(blok.some((satu) => satu.includes("run: npm run setup")));
    assert.ok(blok.some((satu) => satu.includes("node-version-file: .nvmrc")));
  }
  // Build ada tepat sebelum ujinya, di job yang memang memakai hasilnya.
  const teksPeramban = peramban.join("\n");
  assert.ok(
    teksPeramban.indexOf("run: npm run build") <
      teksPeramban.indexOf("run: npm run test:e2e"),
  );
});

test("definisiPemeriksaan mencari langkah dari kuncinya", () => {
  assert.equal(definisiPemeriksaan("build").nama, "Build produksi");
  // Kunci yang tidak dikenal dikembalikan apa adanya, bukan hilang diam-diam.
  assert.deepEqual(definisiPemeriksaan("langkah-asing"), {
    kunci: "langkah-asing",
    nama: "langkah-asing",
    perintah: "",
    keterangan: "",
  });
});

test("barisPemeriksaanCi menggambar seluruh langkah sesuai urutannya", () => {
  const baris = barisPemeriksaanCi(
    jalan({
      status: "gagal",
      pemeriksaan: [
        hasil("penyiapan", "lulus", 41),
        hasil("pemeriksaan-kode", "gagal", 96, "2 uji gagal"),
      ],
    }),
  );

  assert.deepEqual(
    baris.map((item) => item.status),
    ["lulus", "gagal", "dilewati", "dilewati", "dilewati"],
  );
  assert.equal(baris[0].nama, "Penyiapan proyek");
  assert.equal(baris[1].catatan, "2 uji gagal");
  assert.equal(baris[2].durasiDetik, null);
});

test("barisPemeriksaanCi membedakan langkah yang menunggu dari yang dilewati", () => {
  // Jalan yang masih berjalan: langkah berikutnya belum sampai, bukan gagal.
  const berjalan = barisPemeriksaanCi(
    jalan({
      status: "berjalan",
      selesai: null,
      pemeriksaan: [
        hasil("penyiapan", "lulus", 38),
        hasil("pemeriksaan-kode", "berjalan", null),
      ],
    }),
  );
  assert.deepEqual(
    berjalan.map((item) => item.status),
    ["lulus", "berjalan", "menunggu", "menunggu", "menunggu"],
  );
});

test("hitungPemeriksaanCi menghitung tiap keadaan", () => {
  const baris = barisPemeriksaanCi(
    jalan({
      status: "gagal",
      pemeriksaan: [
        hasil("penyiapan", "lulus", 41),
        hasil("pemeriksaan-kode", "gagal", 96),
      ],
    }),
  );
  assert.deepEqual(hitungPemeriksaanCi(baris), {
    total: 5,
    lulus: 1,
    gagal: 1,
    dilewati: 3,
    berjalan: 0,
    menunggu: 0,
  });
});

test("pemeriksaanGagalCi mengambil langkah pertama yang gagal", () => {
  const gagal = jalan({
    status: "gagal",
    pemeriksaan: [
      hasil("penyiapan", "lulus", 39),
      hasil("pemeriksaan-kode", "lulus", 171),
      hasil("format", "gagal", 18, "Tiga berkas belum diformat"),
      hasil("build", "gagal", 162),
    ],
  });
  assert.equal(pemeriksaanGagalCi(gagal).kunci, "format");
  assert.equal(pemeriksaanGagalCi(jalan()), null);
});

test("jalanTerbaru dan jalanTerakhirSelesai memilih dari waktu mulainya", () => {
  const lama = jalan({
    id: "ci-lama",
    mulai: new Date("2026-10-10T10:15:00+07:00"),
  });
  const berjalan = jalan({
    id: "ci-berjalan",
    mulai: new Date("2026-10-13T09:41:00+07:00"),
    selesai: null,
    status: "berjalan",
  });
  const riwayat = [lama, berjalan];

  assert.equal(jalanTerbaru(riwayat).id, "ci-berjalan");
  // Jalan yang belum selesai bukan hasil: yang dipakai jalan sebelumnya.
  assert.equal(jalanTerakhirSelesai(riwayat).id, "ci-lama");
  assert.equal(jalanTerakhirSelesai([]), null);
  assert.equal(ciSedangBerjalan(riwayat).id, "ci-berjalan");
  assert.equal(ciSedangBerjalan([lama]), null);
});

test("lamaDetik menulis lama langkah dan lama jalannya", () => {
  assert.equal(lamaDetik(0), "0 detik");
  assert.equal(lamaDetik(45), "45 detik");
  assert.equal(lamaDetik(60), "1 menit");
  assert.equal(lamaDetik(96), "1 menit 36 detik");
  assert.equal(lamaDetik(640), "10 menit 40 detik");
  assert.equal(lamaDetik(null), null);
});

test("ringkasJalanCi menyebut keadaan dan langkah yang gagal", () => {
  const lulus = jalan({
    pemeriksaan: PEMERIKSAAN_CI.map((item) => hasil(item.kunci, "lulus")),
  });
  assert.equal(ringkasJalanCi(lulus), "Lulus: 5 dari 5 pemeriksaan lulus.");

  const gagal = jalan({
    status: "gagal",
    pemeriksaan: [
      hasil("penyiapan", "lulus", 41),
      hasil("pemeriksaan-kode", "gagal", 96),
    ],
  });
  assert.equal(
    ringkasJalanCi(gagal),
    "Gagal di Pemeriksaan kode & uji otomatis: 1 dari 5 pemeriksaan lulus sebelum berhenti.",
  );

  const berjalan = jalan({
    status: "berjalan",
    selesai: null,
    pemeriksaan: [
      hasil("penyiapan", "lulus", 38),
      hasil("pemeriksaan-kode", "berjalan", null),
    ],
  });
  assert.equal(
    ringkasJalanCi(berjalan),
    "Sedang berjalan: 1 dari 5 pemeriksaan sudah selesai.",
  );
});

test("riwayat contoh memuat jalan berjalan dan urut dari yang paling baru", () => {
  const sekarang = new Date("2026-10-14T08:00:00+07:00");
  const riwayat = getRiwayatCi(sekarang);

  assert.equal(riwayat.length, 5);
  assert.equal(riwayat[0].id, "ci-berjalan");
  for (const [urutan, item] of riwayat.entries()) {
    const berikutnya = riwayat[urutan + 1];
    if (!berikutnya) break;
    assert.ok(
      item.mulai.getTime() >= berikutnya.mulai.getTime(),
      "urutan riwayatnya dari yang paling baru",
    );
  }
  // Isinya disalin, jadi mengubah hasil bacaan tidak merusak data contohnya.
  riwayat[0].pemeriksaan[0].status = "gagal";
  assert.equal(getRiwayatCi(sekarang)[0].pemeriksaan[0].status, "lulus");
});

test("jalan contoh yang berjalan ada di langkah keduanya", () => {
  const sekarang = new Date("2026-10-14T08:00:00+07:00");
  const berjalan = getJalanCiBerjalan(sekarang);

  assert.equal(berjalan.status, "berjalan");
  assert.equal(berjalan.selesai, null);
  assert.equal(
    sekarang.getTime() - berjalan.mulai.getTime(),
    DETIK_BERJALAN_TIRUAN * 1000,
  );
  assert.deepEqual(
    barisPemeriksaanCi(berjalan).map((item) => item.status),
    ["lulus", "berjalan", "menunggu", "menunggu", "menunggu"],
  );
});

test("jalan contoh yang lulus tidak pernah lebih cepat daripada langkahnya", () => {
  const riwayat = getRiwayatCi(new Date("2026-10-14T08:00:00+07:00"));

  for (const item of riwayat) {
    if (item.status === "berjalan") {
      assert.equal(item.selesai, null);
      continue;
    }
    assert.ok(item.selesai, `${item.id} sudah selesai`);
    const lama = item.selesai.getTime() - item.mulai.getTime();
    const jumlahLangkah = item.pemeriksaan.reduce(
      (total, langkah) => total + (langkah.durasiDetik ?? 0),
      0,
    );
    // Lama satu jalan selalu lebih panjang daripada jumlah lama langkahnya.
    assert.ok(
      lama > jumlahLangkah * 1000,
      `${item.id} lama jalannya masuk akal`,
    );
  }
});

test("jalan contoh terakhir yang selesai berhenti di pemeriksaan kode", () => {
  const terakhir = jalanTerakhirSelesai(
    getRiwayatCi(new Date("2026-10-14T08:00:00+07:00")),
  );

  assert.equal(terakhir.status, "gagal");
  assert.equal(pemeriksaanGagalCi(terakhir).kunci, "pemeriksaan-kode");
  assert.equal(hitungPemeriksaanCi(barisPemeriksaanCi(terakhir)).dilewati, 3);
});

test("riwayat contoh memuat jalan yang gagal di uji peramban", () => {
  const peramban = getRiwayatCi(new Date("2026-10-14T08:00:00+07:00")).find(
    (jalan) => jalan.id === "ci-20261010-1015",
  );

  assert.equal(peramban.status, "gagal");
  assert.equal(pemeriksaanGagalCi(peramban).kunci, "uji-end-to-end");
  assert.match(pemeriksaanGagalCi(peramban).catatan, /artefak test-results/);
});

test("saran perbaikan ada untuk tiap langkah baku dan punya cadangan", () => {
  for (const langkah of PEMERIKSAAN_CI) {
    const saran = saranPerbaikan(langkah.kunci);
    assert.equal(SARAN_KEGAGALAN_CI[langkah.kunci], saran);
    assert.ok(saran.length > 20, `saran ${langkah.kunci} cukup jelas`);
  }

  // Langkah asing tetap dapat arahan, bukan kalimat kosong.
  assert.match(saranPerbaikan("langkah-baru"), /Jalankan langkah itu/);
});

test("rincian kegagalan menyebut langkah, akibatnya, dan sarannya", () => {
  const terakhir = jalanTerakhirSelesai(
    getRiwayatCi(new Date("2026-10-14T08:00:00+07:00")),
  );
  const rincian = rincianKegagalanCi(terakhir);

  assert.equal(rincian.pemeriksaan.kunci, "pemeriksaan-kode");
  assert.equal(rincian.pemeriksaan.perintah, "npm run check");
  assert.equal(rincian.pemeriksaan.durasiDetik, 96);
  assert.match(rincian.pemeriksaan.catatan, /2 dari 183 uji gagal/);
  // Langkah sesudahnya batal, dan itu ikut dilaporkan.
  assert.deepEqual(
    rincian.dilewati.map((langkah) => langkah.kunci),
    ["format", "build", "uji-end-to-end"],
  );
  assert.equal(rincian.saran, SARAN_KEGAGALAN_CI["pemeriksaan-kode"]);
});

test("jalan yang lulus atau masih berjalan tidak punya rincian kegagalan", () => {
  const riwayat = getRiwayatCi(new Date("2026-10-14T08:00:00+07:00"));

  assert.equal(rincianKegagalanCi(jalan({ status: "lulus" })), null);
  assert.equal(
    rincianKegagalanCi(jalan({ status: "berjalan", selesai: null })),
    null,
  );
  assert.equal(
    rincianKegagalanCi(riwayat.find((item) => item.id === "ci-20261012-2015")),
    null,
  );
});

test("kegagalan di uji peramban membawa log contoh yang menyebut artefaknya", () => {
  const peramban = getRiwayatCi(new Date("2026-10-14T08:00:00+07:00")).find(
    (jalan) => jalan.id === "ci-20261010-1015",
  );
  const rincian = rincianKegagalanCi(peramban);

  assert.equal(rincian.pemeriksaan.kunci, "uji-end-to-end");
  assert.equal(rincian.dilewati.length, 0);
  // Uji peramban adalah langkah terakhir, jadi tidak ada yang batal sesudahnya.
  const log = logKegagalanTiruan(rincian.pemeriksaan.kunci);
  assert.ok(log.length > 0);
  assert.match(log.join("\n"), /test-results/);
});

test("log kegagalan contoh disalin, bukan dibagikan", () => {
  const log = logKegagalanTiruan("pemeriksaan-kode");
  log.push("baris tambahan");

  assert.notEqual(logKegagalanTiruan("pemeriksaan-kode").length, log.length);
  // Langkah yang belum punya contoh mengembalikan daftar kosong, bukan error.
  assert.deepEqual(logKegagalanTiruan("penyiapan"), []);
});
