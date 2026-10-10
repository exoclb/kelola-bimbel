import test from "node:test";
import assert from "node:assert/strict";
import {
  kelasAktifMurid,
  opsiSaringanMurid,
  saringDaftarMurid,
} from "../src/lib/murid.ts";

// Penyaringan daftar murid (kata kunci, status, cabang, kelas) diuji di sini
// tanpa peramban: halaman daftar murid tinggal memakai fungsi yang sama, jadi
// aturannya tidak bisa berbeda antara yang diuji dan yang tampil.

const murid = (id, nama, tambahan = {}) => ({
  id,
  nama,
  tanggalLahir: "2016-01-01",
  namaOrangTua: `Orang tua ${nama}`,
  kontakOrangTua: "0812-0000-0000",
  statusAktif: true,
  ...tambahan,
});

const daftarMurid = [
  murid("mrd-1", "Aisyah Putri"),
  murid("mrd-2", "Bima Saputra", { namaOrangTua: "Ibu Ratna" }),
  murid("mrd-3", "Citra Ayu", { statusAktif: false }),
  murid("mrd-4", "Dimas Pratama"),
];

const daftarKelas = [
  {
    id: "kls-1",
    namaKelas: "Matematika SD Kelas 4",
    cabang: "Cabang Pusat",
    guruNama: "Ahmad Fauzi",
    jadwal: [],
  },
  {
    id: "kls-2",
    namaKelas: "Bahasa Inggris SMP Kelas 7",
    cabang: "Cabang Pusat",
    guruNama: "Bella Kartika",
    jadwal: [],
  },
  {
    id: "kls-3",
    namaKelas: "IPA SD Kelas 6",
    cabang: "Cabang Utara",
    guruNama: "Ahmad Fauzi",
    jadwal: [],
  },
  {
    id: "kls-4",
    namaKelas: "Calistung TK",
    cabang: "Cabang Pusat",
    guruNama: "Citra Lestari",
    jadwal: [],
  },
];

const penempatan = [
  // mrd-1 aktif di dua cabang sekaligus.
  {
    muridId: "mrd-1",
    kelasId: "kls-1",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
  {
    muridId: "mrd-1",
    kelasId: "kls-3",
    tanggalMulai: "2026-08-01",
    status: "aktif",
  },
  {
    muridId: "mrd-2",
    kelasId: "kls-2",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
  {
    muridId: "mrd-4",
    kelasId: "kls-1",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
  // Penempatan lama tetap tersimpan sebagai riwayat, tetapi bukan kelas aktif.
  {
    muridId: "mrd-4",
    kelasId: "kls-4",
    tanggalMulai: "2026-02-01",
    status: "selesai",
  },
  // Murid nonaktif masih punya penempatan aktif; statusnya tetap yang menahan.
  {
    muridId: "mrd-3",
    kelasId: "kls-2",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
];

const saring = (ubah = {}) => ({
  cari: "",
  status: "semua",
  cabang: "",
  kelasId: "",
  ...ubah,
});

const nama = (hasil) => hasil.map((anak) => anak.nama);

test("saringDaftarMurid menyaring kata kunci nama, orang tua, dan kontak", () => {
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ cari: " ratna " }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Bima Saputra"],
  );
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ cari: "0812" }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Aisyah Putri", "Bima Saputra", "Citra Ayu", "Dimas Pratama"],
  );
  assert.deepEqual(
    saringDaftarMurid(
      daftarMurid,
      saring({ cari: "tidak-ada" }),
      daftarKelas,
      penempatan,
    ),
    [],
  );
});

test("saringDaftarMurid menyaring status tanpa membuang murid tanpa kelas", () => {
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ status: "nonaktif" }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Citra Ayu"],
  );
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ status: "aktif" }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Aisyah Putri", "Bima Saputra", "Dimas Pratama"],
  );
  // Murid baru yang belum ditempatkan tetap muncul kalau statusnya tidak disaring.
  const baru = [...daftarMurid, murid("mrd-9", "Zahra Baru")];
  assert.equal(
    saringDaftarMurid(baru, saring(), daftarKelas, penempatan).length,
    5,
  );
});

test("saringDaftarMurid menyaring per cabang kelas yang masih aktif", () => {
  // mrd-1 punya kelas aktif di dua cabang, jadi ikut muncul di keduanya.
  // Saringan cabang/kelas hanya soal kelas yang diikuti, bukan status anaknya:
  // mrd-3 yang berstatus nonaktif tetap ikut selama penempatannya masih aktif
  // (penyaring statusnya terpisah).
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ cabang: "Cabang Pusat" }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Aisyah Putri", "Bima Saputra", "Citra Ayu", "Dimas Pratama"],
  );
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ cabang: "Cabang Utara" }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Aisyah Putri"],
  );
  // Murid tanpa penempatan aktif (dan murid riwayat selesai saja) tidak ikut.
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ cabang: "Cabang Selatan" }),
        daftarKelas,
        penempatan,
      ),
    ),
    [],
  );
});

test("saringDaftarMurid menyaring per kelas, cabang yang sama dipersempit kelasnya", () => {
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ kelasId: "kls-2" }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Bima Saputra", "Citra Ayu"],
  );
  // kls-4 hanya berisi penempatan berstatus selesai, jadi tidak ada murid aktif.
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ kelasId: "kls-4" }),
        daftarKelas,
        penempatan,
      ),
    ),
    [],
  );
  // Cabang dan kelas digabung, bukan salah satu saja.
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({ cabang: "Cabang Pusat", kelasId: "kls-3" }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Aisyah Putri"],
  );
  // Kata kunci, status, dan kelas bisa dipakai bersamaan.
  assert.deepEqual(
    nama(
      saringDaftarMurid(
        daftarMurid,
        saring({
          cari: "bima",
          status: "aktif",
          cabang: "Cabang Pusat",
          kelasId: "kls-2",
        }),
        daftarKelas,
        penempatan,
      ),
    ),
    ["Bima Saputra"],
  );
});

test("opsiSaringanMurid hanya menawarkan cabang dan kelas yang berisi murid aktif", () => {
  assert.deepEqual(opsiSaringanMurid(daftarKelas, penempatan), {
    cabang: ["Cabang Pusat", "Cabang Utara"],
    kelas: [
      {
        id: "kls-2",
        namaKelas: "Bahasa Inggris SMP Kelas 7",
        cabang: "Cabang Pusat",
      },
      { id: "kls-3", namaKelas: "IPA SD Kelas 6", cabang: "Cabang Utara" },
      {
        id: "kls-1",
        namaKelas: "Matematika SD Kelas 4",
        cabang: "Cabang Pusat",
      },
    ],
  });
  assert.deepEqual(opsiSaringanMurid(daftarKelas, []), {
    cabang: [],
    kelas: [],
  });
});

test("kelasAktifMurid mengembalikan kelas yang masih diikuti, urut nama kelas", () => {
  assert.deepEqual(kelasAktifMurid("mrd-1", daftarKelas, penempatan), [
    { id: "kls-3", namaKelas: "IPA SD Kelas 6", cabang: "Cabang Utara" },
    { id: "kls-1", namaKelas: "Matematika SD Kelas 4", cabang: "Cabang Pusat" },
  ]);
  // Riwayat berstatus selesai (kls-4) tidak ikut.
  assert.deepEqual(kelasAktifMurid("mrd-4", daftarKelas, penempatan), [
    { id: "kls-1", namaKelas: "Matematika SD Kelas 4", cabang: "Cabang Pusat" },
  ]);
  assert.deepEqual(kelasAktifMurid("mrd-9", daftarKelas, penempatan), []);
});
