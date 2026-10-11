import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatKelas,
  buatMurid,
  buatWali,
  pool,
  tautkanWali,
  tempatkanMurid,
} from "./harness/notifikasi.mjs";

// `tests/harness/notifikasi.mjs` sudah memasang penerjemah alias `@/...`, jadi
// layanan aplikasi bisa dimuat apa adanya di bawah ini.
const { listTagihanWali, rekapPemasukanPeriode } =
  await import("../src/services/tagihan.service.ts");

// `listTagihanWali` (`src/services/tagihan.service.ts`) adalah sumber data
// `/api/portal/tagihan` dan `/api/portal/tagihan/bukti`. Batas akses
// endpoint-nya sudah dikunci `e2e/portal-isolasi.spec.ts` dan bentuk balasannya
// di `e2e/portal-tagihan.spec.ts`, tetapi sisi datanya sendiri belum pernah
// disentuh tes unit: penautan `wali_murid` yang menyatu dengan kuerinya, nama
// kelas yang datang dari penempatan aktif, dan penggabungan rekap pemasukan.
// Di situlah kesalahan yang paling mahal — satu baris anak orang lain yang ikut
// terbaca, atau rekap yang tidak sama dengan daftarnya.
//
// Semua periode di berkas ini memakai tahun 2100 (batas atas yang diizinkan
// skema) supaya tidak bertabrakan dengan bulan berjalan maupun dengan berkas
// tes lain, dan setiap tes membersihkan baris ujinya sendiri di awal dan akhir.

/** Satu tagihan langsung ke tabel, supaya status dan tanggal bayarnya bisa diatur. */
async function buatTagihan(
  muridId,
  { periode, nominal, lunas = false, sudahDiingatkan = false },
) {
  const [tahun, bulan] = periode.split("-").map(Number);
  const { rows } = await pool.query(
    `INSERT INTO student_invoices
       (student_id, periode_bulan, periode_tahun, nominal, status, tanggal_bayar, sudah_diingatkan)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      muridId,
      bulan,
      tahun,
      nominal,
      lunas ? "lunas" : "belum_lunas",
      lunas ? `${periode}-10` : null,
      sudahDiingatkan,
    ],
  );
  return rows[0].id;
}

/** Penempatan dengan tanggal mulai tertentu; `tempatkanMurid` selalu memakai hari ini. */
async function tempatkanSejak(
  muridId,
  kelasId,
  tanggalMulai,
  status = "aktif",
) {
  await pool.query(
    `INSERT INTO student_enrollments (student_id, class_id, tanggal_mulai, status)
     VALUES ($1, $2, $3, $4)`,
    [muridId, kelasId, tanggalMulai, status],
  );
}

/** Periode-periode uji milik berkas ini, di luar bulan berjalan. */
const PERIODE_TERTUA = "2100-05";
const PERIODE_BERJALAN = "2100-06";

test("hanya tagihan anak yang tertaut ke akun itu yang dikembalikan", async () => {
  await bersihkan();
  const waliA = await buatWali("Wali Tagihan Anak A");
  const waliB = await buatWali("Wali Tagihan Anak B");
  const anakA = await buatMurid({ label: "Anak Tagihan A" });
  const anakB = await buatMurid({ label: "Anak Tagihan B" });
  const yatim = await buatMurid({ label: "Anak Tagihan Tanpa Wali" });
  await tautkanWali(waliA.id, anakA.id);
  await tautkanWali(waliB.id, anakB.id);

  // Ketiganya ditagih pada periode yang sama, jadi penyaringnya benar-benar
  // penautan wali — bukan kebetulan "periode yang berbeda".
  await buatTagihan(anakA.id, {
    periode: PERIODE_BERJALAN,
    nominal: 250_000,
  });
  await buatTagihan(anakB.id, {
    periode: PERIODE_BERJALAN,
    nominal: 300_000,
  });
  await buatTagihan(yatim.id, { periode: PERIODE_BERJALAN, nominal: 350_000 });

  const milikA = await listTagihanWali(waliA.id, anakA.id);
  assert.equal(milikA.length, 1, "hanya satu tagihan anak A yang ikut");
  assert.equal(milikA[0].muridId, anakA.id);
  assert.equal(milikA[0].nominal, 250_000);

  // Anak yang tertaut ke akun lain tidak pernah terbaca walau id-nya disebut.
  assert.deepEqual(await listTagihanWali(waliA.id, anakB.id), []);
  // Murid yang belum ditautkan ke siapa pun juga tidak.
  assert.deepEqual(await listTagihanWali(waliA.id, yatim.id), []);
  // Dan akun lain tetap mendapat anaknya sendiri, bukan anak A.
  const milikB = await listTagihanWali(waliB.id, anakB.id);
  assert.equal(milikB.length, 1);
  assert.equal(milikB[0].nominal, 300_000);

  await bersihkan();
});

test("anak yang tertaut tetapi belum ditagih menerima daftar kosong, bukan galat", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Anak Belum Ditagih");
  const anak = await buatMurid({ label: "Anak Belum Ditagih" });
  await tautkanWali(wali.id, anak.id);
  // Anak lain ditagih, supaya "kosong" bukan karena tabelnya memang kosong.
  const anakLain = await buatMurid({ label: "Anak Ditagih Lain" });
  await buatTagihan(anakLain.id, {
    periode: PERIODE_BERJALAN,
    nominal: 100_000,
  });

  assert.deepEqual(await listTagihanWali(wali.id, anak.id), []);

  // Id yang bukan murid mana pun juga daftar kosong: yang memutuskan 404
  // adalah endpoint-nya, bukan layanan ini (lihat `muridTertaut`).
  assert.deepEqual(
    await listTagihanWali(wali.id, "00000000-0000-4000-8000-000000000000"),
    [],
  );

  await bersihkan();
});

test("baris tagihan membawa kelas aktif anak dan tanggal bayarnya apa adanya", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Bentuk Baris Tagihan");
  const anak = await buatMurid({ label: "Anak Bentuk Baris" });
  await tautkanWali(wali.id, anak.id);
  const kelas = await buatKelas({ label: "Kelas Bentuk Baris" });
  await tempatkanMurid(anak.id, kelas.id);

  await buatTagihan(anak.id, {
    periode: PERIODE_TERTUA,
    nominal: 175_000,
    lunas: true,
  });
  await buatTagihan(anak.id, {
    periode: PERIODE_BERJALAN,
    nominal: 175_000,
  });

  const daftar = await listTagihanWali(wali.id, anak.id);
  assert.equal(daftar.length, 2);

  for (const baris of daftar) {
    assert.equal(baris.muridId, anak.id);
    assert.equal(baris.muridNama, anak.nama);
    assert.equal(baris.kelasNama, kelas.nama);
    assert.equal(baris.nominal, 175_000);
    assert.equal(
      typeof baris.nominal,
      "number",
      "nominal dikirim angka, bukan teks",
    );
    // `dibuatPada` dipakai penanda "baru"; bentuknya harus bisa dibaca klien.
    assert.equal(
      new Date(baris.dibuatPada).toISOString(),
      baris.dibuatPada,
      "dibuatPada dikirim sebagai waktu ISO",
    );
  }

  const lunas = daftar.find((baris) => baris.status === "lunas");
  assert.ok(lunas, "tagihan yang ditandai lunas ikut terkirim");
  assert.equal(lunas.tanggalBayar, `${PERIODE_TERTUA}-10`);
  const belum = daftar.find((baris) => baris.status === "belum_lunas");
  assert.equal(
    belum.tanggalBayar,
    null,
    "yang belum lunas tidak punya tanggal bayar",
  );
  assert.equal(belum.sudahDiingatkan, false);

  await bersihkan();
});

test("kelas anak diambil dari penempatan aktif terlama, penempatan selesai diabaikan", async () => {
  await bersihkan();
  const wali = await buatWali("Wali Kelas Aktif");
  const anak = await buatMurid({ label: "Anak Kelas Aktif" });
  const anakSelesai = await buatMurid({ label: "Anak Kelas Selesai" });
  await tautkanWali(wali.id, anak.id);
  await tautkanWali(wali.id, anakSelesai.id);

  const kelasLama = await buatKelas({ label: "Kelas Lama" });
  const kelasBaru = await buatKelas({ label: "Kelas Baru" });
  const kelasSelesai = await buatKelas({ label: "Kelas Sudah Selesai" });
  // Sengaja ditulis terbalik (yang baru lebih dulu) supaya urutannya tidak
  // bergantung urutan penulisan.
  await tempatkanSejak(anak.id, kelasBaru.id, "2100-02-01");
  await tempatkanSejak(anak.id, kelasLama.id, "2100-01-01");
  await tempatkanSejak(
    anakSelesai.id,
    kelasSelesai.id,
    "2100-01-01",
    "selesai",
  );

  await buatTagihan(anak.id, { periode: PERIODE_BERJALAN, nominal: 100_000 });
  await buatTagihan(anakSelesai.id, {
    periode: PERIODE_BERJALAN,
    nominal: 100_000,
  });

  const [baris] = await listTagihanWali(wali.id, anak.id);
  assert.equal(
    baris.kelasNama,
    kelasLama.nama,
    "penempatan aktif terlama yang dipakai",
  );

  // Murid yang hanya punya penempatan `selesai` (sudah keluar/pindah) tidak
  // menampilkan kelas yang sudah ditinggalkannya.
  const [barisSelesai] = await listTagihanWali(wali.id, anakSelesai.id);
  assert.equal(barisSelesai.kelasNama, "Belum ada kelas");

  await bersihkan();
});

test("rekap pemasukan per periode menggabungkan lunas dan belum lunas", async () => {
  await bersihkan();
  // Satu murid hanya boleh punya satu tagihan per periode (indeks unik), jadi
  // dua baris pada periode yang sama harus milik murid yang berbeda.
  const anakLunas = await buatMurid({ label: "Anak Rekap Lunas" });
  const anakTunggak = await buatMurid({ label: "Anak Rekap Tunggakan" });
  const anakBulanIni = await buatMurid({ label: "Anak Rekap Bulan Ini" });
  await buatTagihan(anakLunas.id, {
    periode: PERIODE_TERTUA,
    nominal: 200_000,
    lunas: true,
  });
  await buatTagihan(anakTunggak.id, {
    periode: PERIODE_TERTUA,
    nominal: 50_000,
  });
  await buatTagihan(anakBulanIni.id, {
    periode: PERIODE_BERJALAN,
    nominal: 400_000,
    lunas: true,
  });

  const rekap = await rekapPemasukanPeriode();
  // Rekapnya menghitung seluruh basis data, jadi yang diperiksa hanya periode
  // milik berkas ini; itu pun sudah cukup untuk mengunci penggabungannya.
  const tertua = rekap.find((baris) => baris.periode === PERIODE_TERTUA);
  const berjalan = rekap.find((baris) => baris.periode === PERIODE_BERJALAN);

  assert.deepEqual(tertua, {
    periode: PERIODE_TERTUA,
    jumlah: 2,
    jumlahLunas: 1,
    nominalLunas: 200_000,
    jumlahBelumLunas: 1,
    nominalBelumLunas: 50_000,
  });
  assert.deepEqual(berjalan, {
    periode: PERIODE_BERJALAN,
    jumlah: 1,
    jumlahLunas: 1,
    nominalLunas: 400_000,
    jumlahBelumLunas: 0,
    nominalBelumLunas: 0,
  });

  // Periode tanpa tagihan tidak muncul sebagai baris nol — pemanggil yang
  // memperlakukannya sebagai nol lewat `rekapTagihanKosong`.
  assert.equal(
    rekap.some((baris) => baris.periode === "2100-07"),
    false,
  );
  // Periode terbaru lebih dulu, supaya tren arus kas tidak perlu menyortir ulang.
  assert.ok(
    rekap.findIndex((baris) => baris.periode === PERIODE_BERJALAN) <
      rekap.findIndex((baris) => baris.periode === PERIODE_TERTUA),
    "periode terbaru muncul lebih dulu",
  );

  await bersihkan();
});
