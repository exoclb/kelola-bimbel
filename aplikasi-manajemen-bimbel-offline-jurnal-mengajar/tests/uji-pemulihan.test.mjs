// Uji bentuk catatan uji pemulihan backup (src/lib/uji-pemulihan.ts):
// ringkasan pemeriksaan, pemilihan uji terakhir yang berhasil, dan penilaian
// kesegaran bukti pulihnya. Data contoh di src/lib/mock-uji-pemulihan.ts ikut
// diperiksa supaya bentuk halaman Uji Pemulihan Backup tidak melenceng.
//
// Alias "@/..." milik tsconfig diterjemahkan penerjemah bersama di
// tests/dukungan/impor-ts.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

pasangImporTs();

const {
  JEDA_UJI_HARI,
  kesegaranUjiPemulihan,
  namaBerkasUji,
  ringkasanPemeriksaan,
  semuaPemeriksaanLulus,
  ujiTerakhirBerhasil,
} = await import("../src/lib/uji-pemulihan.ts");
const { getBerkasBackupUji, getRiwayatUjiPemulihan } =
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
  assert.ok(riwayat.length >= 2);

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

  // Dua keadaan yang memang ingin terlihat di halaman: ada uji yang gagal,
  // dan ada uji yang berhasil.
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
