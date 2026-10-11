import test from "node:test";
import assert from "node:assert/strict";
import { roles, statement } from "../src/lib/permissions.ts";

// Siapa yang boleh menyentuh data bimbel bersama, diuji langsung ke definisi
// perannya.
//
// Inilah pembeda yang tadinya hilang. Seluruh rute data bimbel (murid, kelas,
// jadwal, penempatan, jurnal, presensi guru) hanya memakai `withApiSession`,
// jadi pemeriksaannya berhenti di "ada sesi yang sah". Akun wali
// (`orang-tua`) juga punya sesi yang sah, sehingga wali bisa membaca daftar
// murid dan bahkan mengubahnya lewat `PATCH /api/murid/:id` — padahal portal
// wali hanya untuk membaca data anaknya sendiri.
//
// Sekarang rute-rute itu dijaga izin `staf`, dan berkas ini mengunci
// definisinya: seluruh peran staf (guru, owner, admin) boleh membaca dan
// menulis, sedangkan `orang-tua` tidak boleh sama sekali — tanpa kehilangan
// izin `portal` yang memang miliknya. Penjaga di sisi HTTP-nya sendiri
// (403 untuk wali, 200 untuk staf) dikunci `e2e/izin-staf.spec.ts`.

/** Peran yang bekerja di bimbel: guru, pemilik, dan admin sistem. */
const PERAN_STAF = ["user", "owner", "admin"];

/** Akun wali: hanya membaca data anaknya lewat portal. */
const PERAN_WALI = "orang-tua";

const AKSI_STAF = ["read", "write"];

test("sumber daya `staf` ada di statement dengan aksi baca dan tulis", () => {
  // Tanpa entri ini, `withApiPermission(request, { staf: [...] })` tidak bisa
  // ditulis sama sekali — tipe `Permissions` dan pemeriksaan perannya
  // bersumber dari daftar yang sama.
  assert.deepEqual(statement.staf, ["read", "write"]);
});

test("peran staf boleh membaca dan menulis data bimbel bersama", () => {
  for (const nama of PERAN_STAF) {
    for (const aksi of AKSI_STAF) {
      assert.equal(
        roles[nama].authorize({ staf: [aksi] }).success,
        true,
        `peran ${nama} harus boleh staf:${aksi}`,
      );
    }
    // Permintaan gabungan (baca dan tulis sekaligus) juga harus lolos, supaya
    // satu endpoint tidak perlu dipecah hanya karena izinnya digabung.
    assert.equal(roles[nama].authorize({ staf: AKSI_STAF }).success, true);
  }
});

test("akun wali ditolak dari seluruh aksi data bimbel", () => {
  for (const aksi of AKSI_STAF) {
    const hasil = roles[PERAN_WALI].authorize({ staf: [aksi] });
    assert.equal(hasil.success, false, `wali tidak boleh staf:${aksi}`);
    // Penolakannya harus berbentuk galat, bukan `success: false` tanpa sebab —
    // itulah yang dibaca `withApiPermission` untuk menjawab 403 FORBIDDEN.
    assert.ok(hasil.error);
  }
});

test("wali tetap boleh membuka portal anaknya", () => {
  assert.equal(
    roles[PERAN_WALI].authorize({ portal: ["read"] }).success,
    true,
    "menutup data bimbel tidak boleh ikut menutup portal wali",
  );
  // Portal bukan jalur masuk guru: peran staf membacanya lewat data bimbel,
  // bukan lewat portal wali.
  assert.equal(roles.user.authorize({ portal: ["read"] }).success, false);
  for (const nama of ["owner", "admin"])
    assert.equal(roles[nama].authorize({ portal: ["read"] }).success, true);
});

test("peran yang tidak dikenal tidak mendapat izin staf", () => {
  // Better Auth memakai `defaultRole` untuk role yang tidak dikenal, jadi
  // pemeriksaan di sini adalah jaring terakhir: nama peran asing tidak boleh
  // cocok dengan `staf` hanya karena tidak ada di daftar.
  for (const nama of ["kepala-sekolah", "support", "guru", ""]) {
    assert.equal(
      roles[nama],
      undefined,
      `peran ${nama} tak seharusnya terdaftar`,
    );
  }
});
