import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatMurid,
  penanda,
  pool,
} from "./harness/notifikasi.mjs";

// `tests/harness/notifikasi.mjs` memasang penerjemah alias `@/...`, jadi
// layanan aplikasi bisa dimuat apa adanya di bawah.
const { catatanPortalAnak } = await import("../src/services/portal.service.ts");
const { createCatatanPerkembangan } =
  await import("../src/services/perkembangan.service.ts");

// `catatanPortalAnak` (`src/services/portal.service.ts`) adalah isi `data` pada
// jawaban `GET /api/portal/perkembangan` dan daftar catatan di layar Progres
// wali. Selama ini yang menguncinya hanya `e2e/perkembangan-portal.spec.ts`:
// bentuk tampilannya (nama kolom `catatan` yang berbeda dari
// `catatanPerkembangan`) dan urutannya belum pernah diuji langsung ke basis
// data. Dua hal itu yang mudah rusak tanpa terlihat — kolom internal ikut
// terkirim ke wali, atau catatan terbaru jatuh di bawah — sedangkan halaman
// hanya membaca apa adanya.
//
// Daftar anaknya sendiri disaring `wali_murid` di endpoint; yang diuji di sini
// batas per anak pada layanannya: id anak lain tidak pernah menambah satu baris.

/** Mencatat satu evaluasi dan mengembalikan baris tersimpannya. */
async function catat(guruId, muridId, { tanggal, nilai, sikap, catatan }) {
  const hasil = await createCatatanPerkembangan(guruId, {
    muridId,
    tanggal,
    nilai,
    sikap,
    catatanPerkembangan: catatan,
  });
  assert.equal(hasil.status, "tersimpan");
  return hasil.catatan;
}

test("catatan anak dikemas sebagai bentuk tampilan portal, bukan baris basis data", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Catatan Portal");
  const anak = await buatMurid({ label: "Anak Catatan Portal" });
  const tersimpan = await catat(guru.id, anak.id, {
    tanggal: "2100-05-06",
    nilai: 88,
    sikap: "Baik sekali",
    catatan: "Sudah lancar pembagian.",
  });

  const [catatan] = await catatanPortalAnak(anak.id);

  assert.equal(catatan.id, tersimpan.id);
  assert.equal(catatan.tanggal, "2100-05-06");
  assert.equal(catatan.sikap, "Baik sekali");
  assert.equal(catatan.catatan, "Sudah lancar pembagian.");
  assert.equal(catatan.guruNama, guru.nama);
  // Nilainya tetap angka: halaman merata-ratakan kolom ini sendiri, dan teks
  // akan membuat rata-ratanya jadi `NaN`.
  assert.equal(typeof catatan.nilai, "number");
  assert.equal(catatan.nilai, 88);

  // Bentuknya persis kontrak `CatatanPerkembangan` di `src/lib/portal-wali.ts`:
  // kolom internal (id anak & guru, nama anak, waktu dibuat/diubah, dan nama
  // kolom basis datanya) tidak ikut terkirim ke wali.
  assert.deepEqual(Object.keys(catatan).sort(), [
    "catatan",
    "guruNama",
    "id",
    "nilai",
    "sikap",
    "tanggal",
  ]);

  await bersihkan();
});

test("catatan terbaru dibaca lebih dulu, yang tanggalnya sama dari yang paling akhir dicatat", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Urutan Catatan");
  const anak = await buatMurid({ label: "Anak Urutan Catatan" });

  // Dua catatan pada tanggal yang sama: yang ditulis belakangan yang di atas,
  // supaya perbaikan terakhir tidak tenggelam di bawah versi lamanya.
  const lama = await catat(guru.id, anak.id, {
    tanggal: "2100-06-01",
    nilai: 70,
    sikap: "Cukup",
    catatan: "Versi lama.",
  });
  const baru = await catat(guru.id, anak.id, {
    tanggal: "2100-06-01",
    nilai: 75,
    sikap: "Cukup",
    catatan: "Versi baru.",
  });
  const lebihBaru = await catat(guru.id, anak.id, {
    tanggal: "2100-06-20",
    nilai: 90,
    sikap: "Sangat baik",
    catatan: "Sudah mahir.",
  });
  const palingLama = await catat(guru.id, anak.id, {
    tanggal: "2100-05-02",
    nilai: 60,
    sikap: "Perlu latihan",
    catatan: "Masih ragu.",
  });

  const daftar = await catatanPortalAnak(anak.id);
  assert.deepEqual(
    daftar.map((catatan) => catatan.id),
    [lebihBaru.id, baru.id, lama.id, palingLama.id],
  );
  // Yang lebih tua tidak pernah menghapus yang lebih baru: keempatnya terbaca.
  assert.equal(daftar.length, 4);

  await bersihkan();
});

test("catatan anak lain tidak ikut ke daftar anak yang diminta", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Catatan Dua Anak");
  const anak = await buatMurid({ label: "Anak Catatan Diminta" });
  const anakLain = await buatMurid({ label: "Anak Catatan Lain" });

  const milikAnak = await catat(guru.id, anak.id, {
    tanggal: "2100-07-01",
    nilai: 80,
    sikap: "Baik",
    catatan: "Milik anak yang diminta.",
  });
  await catat(guru.id, anakLain.id, {
    tanggal: "2100-07-05",
    nilai: 95,
    sikap: "Sangat baik",
    catatan: "Milik anak lain, tanggalnya lebih baru.",
  });

  const daftar = await catatanPortalAnak(anak.id);
  assert.deepEqual(
    daftar.map((catatan) => catatan.id),
    [milikAnak.id],
    "tanggal yang lebih baru milik anak lain tidak menarik barisnya ke sini",
  );

  await bersihkan();
});

test("anak tanpa catatan dan id yang bukan murid sama-sama daftar kosong, bukan galat", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Catatan Kosong");
  const anakTanpaCatatan = await buatMurid({ label: "Anak Tanpa Catatan" });
  const anakDenganCatatan = await buatMurid({ label: "Anak Punya Catatan" });
  await catat(guru.id, anakDenganCatatan.id, {
    tanggal: "2100-08-01",
    nilai: 77,
    sikap: "Baik",
    catatan: "Ada catatannya.",
  });

  assert.deepEqual(await catatanPortalAnak(anakTanpaCatatan.id), []);
  // Halaman menerima daftar kosong ini apa adanya (keadaan "belum ada
  // catatan"), jadi jangan sampai melempar galat untuk id yang tidak ada.
  assert.deepEqual(
    await catatanPortalAnak("00000000-0000-4000-8000-000000000000"),
    [],
  );

  await bersihkan();
});

test("catatan yang dihapus anaknya tidak lagi terbaca walau barisnya dulu ada", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Catatan Terhapus");
  const anak = await buatMurid({ label: "Anak Catatan Terhapus" });
  await catat(guru.id, anak.id, {
    tanggal: "2100-09-01",
    nilai: 82,
    sikap: "Baik",
    catatan: "Catatan yang ikut terhapus.",
  });

  const { rows } = await pool.query(
    "DELETE FROM students WHERE id = $1 AND nama LIKE $2 RETURNING id",
    [anak.id, `${penanda()}%`],
  );
  assert.equal(
    rows.length,
    1,
    "murid uji terhapus lewat jalur biasa (cascade)",
  );

  assert.deepEqual(await catatanPortalAnak(anak.id), []);

  await bersihkan();
});
