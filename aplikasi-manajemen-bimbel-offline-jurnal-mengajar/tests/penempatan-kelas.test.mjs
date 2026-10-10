import test from "node:test";
import assert from "node:assert/strict";
import {
  cabangDariKelas,
  kelasBelumDiikuti,
  periksaPenempatan,
  penghalangCabang,
} from "../src/lib/penempatan-kelas.ts";

// Aturan penempatan murid ke kelas diuji tanpa peramban: halaman detail murid
// dan panel kelas memakai fungsi yang sama, jadi penolakan yang tampil di layar
// dan yang diuji di sini tidak bisa berbeda. Pesannya juga sejalan dengan 409
// `MURID_TIDAK_AKTIF` dan `SUDAH_TERDAFTAR` dari `src/services/kelas.service.ts`.

const kelas = (id, namaKelas, cabang) => ({ id, namaKelas, cabang });
const cabang = (nama, statusAktif) => ({ nama, statusAktif });

const daftarKelas = [
  kelas("kls-1", "Matematika SD Kelas 4", "Cabang Pusat"),
  kelas("kls-2", "Bahasa Inggris SMP Kelas 7", "Cabang Pusat"),
  kelas("kls-3", "IPA SD Kelas 6", "Cabang Utara"),
  kelas("kls-4", "Calistung TK", "Cabang Selatan"),
];

const daftarCabang = [
  cabang("Cabang Pusat", true),
  cabang("Cabang Selatan", false),
  cabang("Cabang Utara", true),
];

const murid = (tambahan = {}) => ({
  id: "mrd-1",
  nama: "Aisyah Putri",
  statusAktif: true,
  ...tambahan,
});

const penempatan = (muridId, kelasId, status) => ({ muridId, kelasId, status });

test("kelas yang sedang aktif tidak ditawarkan, kelas yang pernah diikuti tetap", () => {
  const hasil = kelasBelumDiikuti({
    muridId: "mrd-1",
    daftarKelas,
    penempatan: [
      penempatan("mrd-1", "kls-1", "aktif"),
      penempatan("mrd-1", "kls-2", "selesai"),
      penempatan("mrd-2", "kls-3", "aktif"),
    ],
  });

  assert.deepEqual(
    hasil.map((baris) => baris.id),
    ["kls-2", "kls-3", "kls-4"],
  );
});

test("penempatan kedua di kelas yang sama ditolak sebagai duplikat", () => {
  const hasil = periksaPenempatan({
    murid: murid(),
    kelasId: "kls-1",
    daftarKelas,
    daftarCabang,
    penempatan: [penempatan("mrd-1", "kls-1", "aktif")],
  });

  assert.equal(hasil.boleh, false);
  assert.equal(hasil.alasan, "sudah_terdaftar");
  assert.equal(hasil.pesan, "Aisyah Putri sudah terdaftar di kelas ini.");
});

test("murid yang sudah tidak aktif ditolak dengan alasan yang sama seperti API", () => {
  const hasil = periksaPenempatan({
    murid: murid({ statusAktif: false }),
    kelasId: "kls-1",
    daftarKelas,
    daftarCabang,
    penempatan: [],
  });

  assert.equal(hasil.boleh, false);
  assert.equal(hasil.alasan, "murid_nonaktif");
  assert.equal(
    hasil.pesan,
    "Aisyah Putri sudah tidak aktif, jadi belum bisa ditempatkan. Aktifkan dulu di halaman Murid.",
  );
});

test("murid nonaktif yang sudah terdaftar tetap disebut tidak aktif", () => {
  const hasil = periksaPenempatan({
    murid: murid({ statusAktif: false }),
    kelasId: "kls-1",
    daftarKelas,
    daftarCabang,
    penempatan: [penempatan("mrd-1", "kls-1", "aktif")],
  });

  assert.equal(hasil.alasan, "murid_nonaktif");
});

test("kelas yang tidak ada lagi ditolak tanpa menyalahkan muridnya", () => {
  const hasil = periksaPenempatan({
    murid: murid(),
    kelasId: "kls-hilang",
    daftarKelas,
    daftarCabang,
    penempatan: [],
  });

  assert.equal(hasil.boleh, false);
  assert.equal(hasil.alasan, "kelas_tidak_ada");
  assert.match(hasil.pesan, /tidak ada lagi/);
});

test("kelas di cabang nonaktif ditolak saat cabangnya diperiksa", () => {
  const hasil = periksaPenempatan({
    murid: murid(),
    kelasId: "kls-4",
    daftarKelas,
    daftarCabang,
    penempatan: [],
    periksaCabang: true,
  });

  assert.equal(hasil.boleh, false);
  assert.equal(hasil.alasan, "cabang_nonaktif");
  assert.equal(
    hasil.pesan,
    "Kelas Calistung TK berada di cabang Cabang Selatan yang nonaktif, jadi belum bisa dipakai untuk penempatan baru. Aktifkan dulu cabangnya di halaman Cabang.",
  );
});

test("kelas di cabang nonaktif tetap boleh dipakai panel kelas", () => {
  const hasil = periksaPenempatan({
    murid: murid(),
    kelasId: "kls-4",
    daftarKelas,
    daftarCabang,
    penempatan: [],
  });

  assert.deepEqual(hasil, { boleh: true });
});

test("kelas yang cabangnya belum terdaftar ditolak dengan alasannya", () => {
  const tanpaCabangSelatan = daftarCabang.filter(
    (baris) => baris.nama !== "Cabang Selatan",
  );
  const hasil = periksaPenempatan({
    murid: murid(),
    kelasId: "kls-4",
    daftarKelas,
    daftarCabang: tanpaCabangSelatan,
    penempatan: [],
    periksaCabang: true,
  });

  assert.equal(hasil.boleh, false);
  assert.equal(hasil.alasan, "cabang_belum_terdaftar");
  assert.match(hasil.pesan, /cabang Cabang Selatan yang belum terdaftar/);

  const penghalang = penghalangCabang(daftarKelas[3], tanpaCabangSelatan);
  assert.equal(penghalang?.alasan, "cabang_belum_terdaftar");
});

test("nama cabang dicocokkan tanpa peduli spasi tepi dan besar-kecil huruf", () => {
  const cabangAda = cabangDariKelas(
    { cabang: "  cabang PUSAT " },
    daftarCabang,
  );
  assert.equal(cabangAda?.nama, "Cabang Pusat");

  const hasil = periksaPenempatan({
    murid: murid(),
    kelasId: "kls-1",
    daftarKelas: [kelas("kls-1", "Matematika SD Kelas 4", " cabang pusat ")],
    daftarCabang,
    penempatan: [],
    periksaCabang: true,
  });
  assert.deepEqual(hasil, { boleh: true });
});

test("penempatan yang masih boleh disimpan dijawab boleh", () => {
  const hasil = periksaPenempatan({
    murid: murid(),
    kelasId: "kls-3",
    daftarKelas,
    daftarCabang,
    penempatan: [
      penempatan("mrd-1", "kls-1", "aktif"),
      penempatan("mrd-1", "kls-2", "selesai"),
    ],
    periksaCabang: true,
  });

  assert.deepEqual(hasil, { boleh: true });
});
