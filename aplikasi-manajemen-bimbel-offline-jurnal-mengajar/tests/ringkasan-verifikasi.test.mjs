import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Alias `@/...` dan impor tanpa akhiran diterjemahkan oleh harness ini.
import "./harness/alias.mjs";

const AKAR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const {
  KASUS_VERIFIKASI,
  LABEL_STATUS_VERIFIKASI,
  PERISTIWA_UJI,
  UJI_PREFERENSI,
  UJI_TANDAI_DIBACA,
  ringkasVerifikasi,
} = await import("../src/lib/mock-verifikasi-notifikasi.ts");

// Ringkasan verifikasi notifikasi: kartu "x dari y lulus", "perlu ditinjau",
// dan "belum diperiksa" di halaman `/app/notifikasi/verifikasi` dihitung
// `ringkasVerifikasi` dari daftar kasusnya — bukan angka tetap — dan kartu
// ringkas di halaman Pengaturan memakai fungsi yang sama. Karena itu yang
// dikunci di sini adalah dua hal: pembagiannya, dan bahwa setiap hasil uji yang
// diringkas benar-benar menunjuk berkas serta judul tes yang ada. Tanpa
// pemeriksaan kedua, ringkasan bisa terus mengklaim sesuatu yang sudah tidak
// diuji lagi — persis yang membuat halaman verifikasi tidak berguna.
//
// Berkasnya sendiri tidak menyentuh basis data: seluruh datanya statis.

const STATUS = ["lulus", "perlu-ditinjau", "belum-diperiksa"];

/** Kasus tiruan; `ringkasVerifikasi` hanya membaca `status`-nya. */
function kasus(id, status) {
  return { id, status };
}

const AKHIRAN_TES = /\.(test\.mjs|spec\.ts)$/;

/**
 * Sitasi hasil uji ditulis `berkas · judul tes`, dan satu selnya boleh memuat
 * beberapa pasangan sekaligus (`… · a.test.mjs · judul a · b.spec.ts · judul b`).
 * Diuraikan begitu supaya tiap judul dipasangkan ke berkasnya sendiri.
 */
function uraikanSitasi(teks) {
  const hasil = [];
  let berkas = null;
  for (const bagian of teks.split(" · ")) {
    if (AKHIRAN_TES.test(bagian)) {
      berkas = bagian;
      hasil.push({ berkas, judul: [] });
      continue;
    }
    if (hasil.length === 0) throw new Error(`Sitasi tanpa berkas: ${teks}`);
    hasil[hasil.length - 1].judul.push(bagian);
  }
  return hasil.map((satu) => ({
    berkas: satu.berkas,
    judul: satu.judul.join(" · "),
  }));
}

/**
 * Angka yang ditampilkan kartu ringkasan dihitung per status, bukan sekadar
 * jumlah baris: daftar yang statusnya bertukar tempat ikut menggeser angkanya.
 */
test("ringkasVerifikasi menghitung tiap status dari daftar kasusnya", () => {
  assert.deepEqual(
    ringkasVerifikasi([
      kasus("lulus-a", "lulus"),
      kasus("lulus-b", "lulus"),
      kasus("tinjau", "perlu-ditinjau"),
      kasus("belum", "belum-diperiksa"),
    ]),
    { total: 4, lulus: 2, perluDitinjau: 1, belumDiperiksa: 1 },
  );

  assert.deepEqual(
    ringkasVerifikasi([
      kasus("belum", "belum-diperiksa"),
      kasus("tinjau", "perlu-ditinjau"),
      kasus("tinjau-lagi", "perlu-ditinjau"),
    ]),
    { total: 3, lulus: 0, perluDitinjau: 2, belumDiperiksa: 1 },
  );
});

/**
 * Daftar kosong pun harus menghasilkan angka nol, bukan `NaN`: panel pantauan
 * dan halaman verifikasi memanggil fungsi ini tanpa saringan apa pun, jadi
 * keadaan "belum ada kasus" harus tetap bisa ditampilkan.
 */
test("ringkasVerifikasi menghasilkan nol untuk daftar kosong", () => {
  assert.deepEqual(ringkasVerifikasi([]), {
    total: 0,
    lulus: 0,
    perluDitinjau: 0,
    belumDiperiksa: 0,
  });
});

/**
 * Kasus yang benar-benar ditampilkan halaman: tiap statusnya punya lencana,
 * punya label, dan terbagi habis ke ketiga angka ringkasan — kasus dengan
 * status di luar ketiganya akan dihitung `total` tetapi tidak muncul di kartu
 * mana pun, dan itu justru membuat ringkasannya berbohong.
 */
test("kasus sungguhan terbagi habis ke ketiga lencana statusnya", () => {
  const ringkas = ringkasVerifikasi();
  assert.deepEqual(ringkas, ringkasVerifikasi(KASUS_VERIFIKASI));
  assert.equal(ringkas.total, KASUS_VERIFIKASI.length);

  const hitung = (status) =>
    KASUS_VERIFIKASI.filter((satu) => satu.status === status).length;
  assert.equal(ringkas.lulus, hitung("lulus"));
  assert.equal(ringkas.perluDitinjau, hitung("perlu-ditinjau"));
  assert.equal(ringkas.belumDiperiksa, hitung("belum-diperiksa"));
  assert.equal(
    ringkas.lulus + ringkas.perluDitinjau + ringkas.belumDiperiksa,
    ringkas.total,
    "tidak ada kasus yang jatuh di luar ketiga kartu ringkasan",
  );

  assert.deepEqual(
    Object.keys(LABEL_STATUS_VERIFIKASI).sort(),
    [...STATUS].sort(),
    "tiap status yang mungkin punya label lencananya",
  );

  for (const satu of KASUS_VERIFIKASI) {
    assert.ok(
      STATUS.includes(satu.status),
      `${satu.id} memakai status yang dikenal halaman`,
    );
    assert.ok(
      LABEL_STATUS_VERIFIKASI[satu.status],
      `${satu.id} punya label lencana`,
    );
    for (const bagian of ["judul", "keterangan", "hasil", "sumber"])
      assert.ok(satu[bagian].trim().length > 0, `${satu.id} mengisi ${bagian}`);
    assert.ok(satu.bukti.length > 0, `${satu.id} menyebut buktinya`);
  }
});

/**
 * Sumber pemicu tiap kasus harus menunjuk berkas yang ada: halaman ini dipakai
 * untuk menelusuri "notifikasi ini dikirim dari mana", jadi jalur yang salah
 * membuat penelusurannya buntu.
 */
test("sumber pemicu tiap kasus menunjuk berkas yang ada", () => {
  for (const satu of KASUS_VERIFIKASI) {
    const jalur = satu.sumber
      .split(" · ")
      .filter((bagian) =>
        /^(src|scripts|drizzle|docs|tests|e2e)\//.test(bagian),
      );
    assert.ok(jalur.length > 0, `${satu.id} menyebut jalur kode`);
    for (const bagian of jalur)
      assert.ok(
        existsSync(resolve(AKAR, bagian)),
        `${satu.id} menunjuk berkas yang ada: ${bagian}`,
      );
  }
});

/**
 * Setiap nama tes yang dipakai sebagai bukti di ketiga tabel halaman harus
 * benar-benar ada di berkasnya, dengan judul yang sama persis. Ini yang
 * menjaga ringkasan tetap jujur: tes yang diubah namanya, dipindah, atau
 * dihapus akan ketahuan di sini, bukan baru saat ada yang membuka halaman dan
 * mengira perilakunya masih dikunci.
 */
test("hasil uji yang diringkas menunjuk berkas dan judul tes yang ada", () => {
  const sitasi = [
    ...PERISTIWA_UJI.flatMap((peristiwa) => peristiwa.tes),
    ...UJI_PREFERENSI.map((uji) => uji.tes),
    ...UJI_TANDAI_DIBACA.map((uji) => uji.tes),
  ];
  assert.ok(sitasi.length > 0, "ada hasil uji yang diringkas");

  for (const teks of sitasi) {
    const pasangan = uraikanSitasi(teks);
    assert.ok(pasangan.length > 0, `sitasi terurai: ${teks}`);
    for (const { berkas, judul } of pasangan) {
      const jalur = resolve(AKAR, berkas);
      assert.ok(existsSync(jalur), `berkas tes ada: ${berkas}`);
      assert.ok(
        readFileSync(jalur, "utf8").includes(`test("${judul}"`),
        `${berkas} masih punya tes "${judul}"`,
      );
    }
  }
});
