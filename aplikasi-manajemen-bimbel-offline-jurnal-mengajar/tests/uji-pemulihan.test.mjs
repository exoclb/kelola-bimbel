// Uji bentuk catatan uji pemulihan backup (src/lib/uji-pemulihan.ts):
// ringkasan pemeriksaan, pemilihan uji terakhir yang berhasil, penilaian
// kesegaran bukti pulihnya, dan tahap proses pemulihan yang sedang berjalan.
// Data contoh di src/lib/mock-uji-pemulihan.ts ikut diperiksa supaya bentuk
// halaman Uji Pemulihan Backup tidak melenceng.
//
// Alias "@/..." milik tsconfig diterjemahkan penerjemah bersama di
// tests/dukungan/impor-ts.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

pasangImporTs();

const {
  DETIK_PER_TAHAP,
  JEDA_UJI_HARI,
  TAHAP_PEMULIHAN,
  indeksTahapBerjalan,
  kesegaranUjiPemulihan,
  namaBerkasUji,
  perkiraanSelesai,
  persenPemulihan,
  ringkasanPemeriksaan,
  semuaPemeriksaanLulus,
  statusTahap,
  ujiSedangBerjalan,
  ujiTerakhirBerhasil,
} = await import("../src/lib/uji-pemulihan.ts");
const { getBerkasBackupUji, getRiwayatUjiPemulihan, getUjiPemulihanBerjalan } =
  await import("../src/lib/mock-uji-pemulihan.ts");

/** Satu uji pemulihan lengkap; tiap tes menimpanya seperlunya. */
function uji(ubah = {}) {
  return {
    id: "uji-1",
    berkas: "/var/backups/kelola/20260705-020000.dump",
    lingkungan: "kelola_restore",
    mulai: new Date("2026-07-05T09:15:00+07:00"),
    selesai: new Date("2026-07-05T09:19:00+07:00"),
    status: "berhasil",
    pemeriksaan: [
      { nama: "Jumlah murid sesuai", lulus: true },
      { nama: "Jumlah jurnal mengajar sesuai", lulus: true },
    ],
    catatan: null,
    ...ubah,
  };
}

test("namaBerkasUji mengambil nama berkasnya, bukan path lengkapnya", () => {
  assert.equal(
    namaBerkasUji("/var/backups/kelola/20260705-020000.dump"),
    "20260705-020000.dump",
  );
  assert.equal(namaBerkasUji("20260705-020000.dump"), "20260705-020000.dump");
  assert.equal(namaBerkasUji(""), "");
});

test("ringkasanPemeriksaan menghitung pemeriksaan yang lulus", () => {
  assert.equal(ringkasanPemeriksaan(uji()), "2 dari 2 pemeriksaan lulus");
  assert.equal(
    ringkasanPemeriksaan(
      uji({
        pemeriksaan: [
          { nama: "Jumlah murid sesuai", lulus: true },
          { nama: "Jumlah tagihan sesuai", lulus: false },
          { nama: "Akun owner bisa masuk", lulus: false },
        ],
      }),
    ),
    "1 dari 3 pemeriksaan lulus",
  );
});

test("semuaPemeriksaanLulus butuh minimal satu pemeriksaan", () => {
  assert.equal(semuaPemeriksaanLulus(uji()), true);
  assert.equal(
    semuaPemeriksaanLulus(
      uji({
        pemeriksaan: [
          { nama: "Jumlah murid sesuai", lulus: true },
          { nama: "Jumlah tagihan sesuai", lulus: false },
        ],
      }),
    ),
    false,
  );
  // Belum diperiksa (mis. pemulihannya berhenti di tengah) bukan berarti lulus.
  assert.equal(semuaPemeriksaanLulus(uji({ pemeriksaan: [] })), false);
});

test("ujiTerakhirBerhasil mengambil catatan berhasil paling baru", () => {
  const lama = uji({
    id: "uji-lama",
    mulai: new Date("2026-03-02T08:20:00+07:00"),
  });
  const baru = uji({
    id: "uji-baru",
    mulai: new Date("2026-07-05T09:15:00+07:00"),
  });
  const gagal = uji({
    id: "uji-gagal",
    mulai: new Date("2026-06-14T10:40:00+07:00"),
    status: "gagal",
  });
  const berjalan = uji({
    id: "uji-berjalan",
    mulai: new Date("2026-08-01T10:40:00+07:00"),
    status: "berjalan",
    selesai: null,
  });

  // Urutan masukan tidak menentukan: yang dipakai waktunya.
  assert.equal(
    ujiTerakhirBerhasil([baru, gagal, lama, berjalan])?.id,
    "uji-baru",
  );
  assert.equal(ujiTerakhirBerhasil([baru, lama])?.id, "uji-baru");
  assert.equal(ujiTerakhirBerhasil([lama, baru])?.id, "uji-baru");
  // Uji yang gagal maupun yang masih berjalan bukan bukti pulih.
  assert.equal(ujiTerakhirBerhasil([gagal, berjalan]), null);
  assert.equal(ujiTerakhirBerhasil([]), null);
});

test("kesegaranUjiPemulihan melaporkan keadaan belum pernah diuji", () => {
  const kesegaran = kesegaranUjiPemulihan(null);
  assert.equal(kesegaran.tingkat, "belum-pernah");
  assert.equal(kesegaran.label, "Belum pernah diuji");
  assert.match(kesegaran.keterangan, /belum bisa diandalkan/);
});

test("kesegaranUjiPemulihan masih berlaku dalam selang uji ulang", () => {
  const sekarang = new Date("2026-10-13T10:00:00+07:00");
  assert.equal(
    kesegaranUjiPemulihan(new Date("2026-10-03T10:00:00+07:00"), {
      sekarang,
    }).tingkat,
    "terbaru",
  );
  assert.equal(
    kesegaranUjiPemulihan(new Date("2026-10-03T10:00:00+07:00"), {
      sekarang,
    }).label,
    "Masih berlaku",
  );
  // Tepat pada batas selangnya belum dianggap lewat.
  assert.equal(
    kesegaranUjiPemulihan(new Date("2026-07-15T10:00:00+07:00"), {
      sekarang,
    }).tingkat,
    "terbaru",
  );
});

test("kesegaranUjiPemulihan meminta uji ulang setelah selangnya lewat", () => {
  const sekarang = new Date("2026-10-13T10:00:00+07:00");
  const kesegaran = kesegaranUjiPemulihan(
    new Date("2026-07-05T09:15:00+07:00"),
    { sekarang },
  );
  assert.equal(kesegaran.tingkat, "perlu-diulang");
  assert.equal(kesegaran.label, "Perlu diuji ulang");
  assert.match(kesegaran.keterangan, /sudah 100 hari lalu/);
  assert.match(kesegaran.keterangan, /setiap 90 hari/);

  // Selangnya bisa diganti pemanggil.
  assert.equal(
    kesegaranUjiPemulihan(new Date("2026-10-03T10:00:00+07:00"), {
      sekarang,
      jedaHari: 5,
    }).tingkat,
    "perlu-diulang",
  );
});

test("riwayat uji pemulihan tiruan berbentuk catatan yang masuk akal", () => {
  const riwayat = getRiwayatUjiPemulihan();
  assert.ok(riwayat.length >= 3);

  // Yang paling baru lebih dulu, dan bentuknya sesuai tipe di src/lib.
  for (const [urutan, catatan] of riwayat.entries()) {
    assert.ok(["berjalan", "berhasil", "gagal"].includes(catatan.status));
    assert.ok(catatan.berkas.startsWith("/"));
    assert.ok(catatan.lingkungan.length > 0);
    assert.ok(catatan.mulai instanceof Date);
    assert.ok(Array.isArray(catatan.pemeriksaan));
    if (urutan > 0)
      assert.ok(
        catatan.mulai.getTime() <= riwayat[urutan - 1].mulai.getTime(),
        "riwayat harus urut dari yang paling baru",
      );
  }

  // Tiga keadaan yang memang ingin terlihat di halaman: ada proses yang masih
  // berjalan, ada uji yang gagal, dan ada uji yang berhasil.
  assert.ok(riwayat.some((catatan) => catatan.status === "berjalan"));
  assert.ok(riwayat.some((catatan) => catatan.status === "gagal"));
  assert.ok(riwayat.some((catatan) => catatan.status === "berhasil"));

  // Salinan: mengubah hasilnya tidak ikut mengubah data tiruannya.
  const sebelum = getRiwayatUjiPemulihan()[0].pemeriksaan.length;
  riwayat[0].berkas = "/ubah.dump";
  riwayat[0].pemeriksaan.push({ nama: "Rusak", lulus: false });
  assert.notEqual(getRiwayatUjiPemulihan()[0].berkas, "/ubah.dump");
  assert.equal(getRiwayatUjiPemulihan()[0].pemeriksaan.length, sebelum);
});

test("berkas backup tiruan siap diuji dan urut dari yang terbaru", () => {
  const berkas = getBerkasBackupUji();
  assert.ok(berkas.length >= 1);

  for (const [urutan, salinan] of berkas.entries()) {
    assert.ok(salinan.lokasi.startsWith("/"));
    assert.ok(salinan.dibuat instanceof Date);
    assert.ok(salinan.ukuranByte > 0);
    if (urutan > 0)
      assert.ok(
        salinan.dibuat.getTime() <= berkas[urutan - 1].dibuat.getTime(),
        "berkas harus urut dari yang paling baru",
      );
  }

  berkas[0].lokasi = "/ubah.dump";
  assert.notEqual(getBerkasBackupUji()[0].lokasi, "/ubah.dump");
});

test("kesegaran uji terakhir pada data tiruan sesuai selang anjurannya", () => {
  const terakhir = ujiTerakhirBerhasil(getRiwayatUjiPemulihan());
  assert.ok(terakhir);
  assert.equal(terakhir.status, "berhasil");

  const kesegaran = kesegaranUjiPemulihan(terakhir.mulai, {
    sekarang: new Date("2026-10-13T10:00:00+07:00"),
  });
  assert.equal(kesegaran.tingkat, "perlu-diulang");
  assert.equal(JEDA_UJI_HARI, 90);
});

test("tahap pemulihan berurutan dari persiapan sampai pencatatan", () => {
  assert.equal(TAHAP_PEMULIHAN.length, 4);
  assert.equal(TAHAP_PEMULIHAN[0].kunci, "siapkan-database");
  assert.equal(
    TAHAP_PEMULIHAN[TAHAP_PEMULIHAN.length - 1].kunci,
    "catat-hasil",
  );
  for (const tahap of TAHAP_PEMULIHAN) {
    assert.ok(tahap.label.length > 0);
    assert.ok(tahap.keterangan.length > 0);
  }
  assert.ok(DETIK_PER_TAHAP > 0);
});

test("indeksTahapBerjalan mengikuti umur prosesnya sampai tahap terakhir", () => {
  const mulai = new Date("2026-10-13T10:00:00+07:00");
  const detik = (nilai) => new Date(mulai.getTime() + nilai * 1000);

  assert.equal(indeksTahapBerjalan(mulai, mulai), 0);
  assert.equal(indeksTahapBerjalan(mulai, detik(DETIK_PER_TAHAP - 1)), 0);
  assert.equal(indeksTahapBerjalan(mulai, detik(DETIK_PER_TAHAP)), 1);
  assert.equal(indeksTahapBerjalan(mulai, detik(95)), 2);
  // Proses yang lebih lama dari seluruh tahapnya tetap di tahap terakhir.
  assert.equal(
    indeksTahapBerjalan(mulai, detik(DETIK_PER_TAHAP * 10)),
    TAHAP_PEMULIHAN.length - 1,
  );
  // Waktu yang lebih awal dari mulai prosesnya tidak membuat indeksnya negatif.
  assert.equal(indeksTahapBerjalan(mulai, detik(-30)), 0);
});

test("persenPemulihan dan perkiraanSelesai mengikuti jumlah tahapnya", () => {
  const mulai = new Date("2026-10-13T10:00:00+07:00");
  const seluruhDetik = TAHAP_PEMULIHAN.length * DETIK_PER_TAHAP;

  assert.equal(persenPemulihan(mulai, mulai), 0);
  assert.equal(
    persenPemulihan(
      mulai,
      new Date(mulai.getTime() + (seluruhDetik / 2) * 1000),
    ),
    50,
  );
  assert.equal(
    persenPemulihan(mulai, new Date(mulai.getTime() + seluruhDetik * 1000)),
    100,
  );
  // Yang lebih lama dari perkiraannya berhenti di 100%, tidak lebih.
  assert.equal(
    persenPemulihan(mulai, new Date(mulai.getTime() + seluruhDetik * 5000)),
    100,
  );
  assert.equal(
    persenPemulihan(mulai, new Date(mulai.getTime() - 60 * 1000)),
    0,
  );

  assert.equal(
    perkiraanSelesai(mulai).getTime(),
    mulai.getTime() + seluruhDetik * 1000,
  );
});

test("statusTahap menandai yang sudah lewat, yang jalan, dan yang menunggu", () => {
  // Uji yang berhasil melewati seluruh tahapnya.
  for (let urutan = 0; urutan < TAHAP_PEMULIHAN.length; urutan += 1)
    assert.equal(statusTahap(urutan, 3, "berhasil"), "selesai");

  // Uji yang masih berjalan: sebelum tahap aktif selesai, sesudahnya menunggu.
  assert.equal(statusTahap(0, 2, "berjalan"), "selesai");
  assert.equal(statusTahap(1, 2, "berjalan"), "selesai");
  assert.equal(statusTahap(2, 2, "berjalan"), "berjalan");
  assert.equal(statusTahap(3, 2, "berjalan"), "menunggu");

  // Uji yang gagal berhenti di tahap aktifnya; sisanya tidak pernah dikerjakan.
  assert.equal(statusTahap(0, 1, "gagal"), "selesai");
  assert.equal(statusTahap(1, 1, "gagal"), "gagal");
  assert.equal(statusTahap(2, 1, "gagal"), "menunggu");
});

test("ujiSedangBerjalan memilih proses paling baru dan null kalau tidak ada", () => {
  const berjalanLama = uji({
    id: "uji-jalan-lama",
    mulai: new Date("2026-07-01T09:00:00+07:00"),
    status: "berjalan",
    selesai: null,
    pemeriksaan: [],
  });
  const berjalanBaru = uji({
    id: "uji-jalan-baru",
    mulai: new Date("2026-07-05T09:15:00+07:00"),
    status: "berjalan",
    selesai: null,
    pemeriksaan: [],
  });

  assert.equal(
    ujiSedangBerjalan([berjalanLama, berjalanBaru])?.id,
    "uji-jalan-baru",
  );
  assert.equal(ujiSedangBerjalan([uji()]), null);
  assert.equal(ujiSedangBerjalan([]), null);
});

test("data tiruan menyediakan proses yang sedang berjalan", () => {
  const berjalan = getUjiPemulihanBerjalan();
  assert.ok(berjalan);
  assert.equal(berjalan.status, "berjalan");
  assert.equal(berjalan.selesai, null);
  assert.deepEqual(berjalan.pemeriksaan, []);
  // Umurnya dihitung dari waktu sekarang, jadi tahapnya bergerak tiap halaman
  // dibuka: hampir dua menit setelah mulainya, dia ada di tahap ketiga.
  assert.equal(
    indeksTahapBerjalan(
      berjalan.mulai,
      new Date(berjalan.mulai.getTime() + 95 * 1000),
    ),
    2,
  );
  assert.ok(
    berjalan.mulai.getTime() <= Date.now(),
    "proses tiruan harus sudah dimulai",
  );
  assert.ok(
    getRiwayatUjiPemulihan().some((catatan) => catatan.status === "berjalan"),
    "proses yang berjalan ikut terbaca di riwayat",
  );
});
