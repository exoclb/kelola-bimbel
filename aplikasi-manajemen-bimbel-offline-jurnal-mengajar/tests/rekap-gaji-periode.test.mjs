import test from "node:test";
import assert from "node:assert/strict";
import {
  bersihkan,
  buatGuru,
  buatKelas,
  pool,
  picuRekapHonor,
} from "./harness/notifikasi.mjs";

const { rekapGajiAnyBulanan, rekapGajiGuru } =
  await import("../src/services/gaji.service.ts");
const { periodeGajiSchema, ubahPembayaranGajiSchema } =
  await import("../src/validators/gaji.ts");

// Rekap gaji per periode diuji di sini, bukan lewat peramban: halaman
// "Rekap Gaji Saya" (dari sesi guru, `rekapGajiGuru`) dan "Rekap Gaji Bulanan"
// (owner, `rekapGajiAnyBulanan`) menghitung angka yang sama dengan dua query
// berbeda. Kalau keduanya berbeda, guru melihat angka yang bukan angka yang
// dibayarkan owner — jadi yang dikunci di sini adalah kesamaan keduanya,
// lengkap dengan aturan periode mana dan tarif mana yang dipakai.
//
// Semua baris uji memakai periode 2096-03 supaya tidak bertabrakan dengan
// bulan berjalan (dipakai berkas tes lain) maupun dengan tanggal tarif berkas
// tes lain (2097, 2098, 2099).

const PERIODE = "2096-03";
const TARIF_AWAL = "2096-03-01";
const TARIF_NAIK = "2096-03-25";
const TARIF_BULAN_DEPAN = "2096-04-01";

/** Hapus hanya baris `salary_settings` milik berkas ini. */
async function bersihkanTarif() {
  await pool.query(
    "DELETE FROM salary_settings WHERE berlaku_sejak BETWEEN $1 AND $2",
    [TARIF_AWAL, TARIF_BULAN_DEPAN],
  );
}

/** Satu aturan tarif uji; tanggalnya sengaja tetap supaya tesnya bisa diulang. */
async function aturTarif(tarifPerJam, berlakuSejak) {
  await pool.query(
    `INSERT INTO salary_settings (tarif_per_jam, skema, berlaku_sejak)
     VALUES ($1, 'per jam', $2)
     ON CONFLICT (berlaku_sejak) DO UPDATE SET tarif_per_jam = $1`,
    [tarifPerJam, berlakuSejak],
  );
}

/** Jurnal satu sesi mengajar; ditulis langsung supaya tanggalnya bisa dipilih. */
async function jurnal(guruId, classId, tanggal, jamMengajar, materi) {
  await pool.query(
    `INSERT INTO teaching_journals (guru_id, class_id, tanggal, materi, jam_mengajar)
     VALUES ($1, $2, $3, $4, $5)`,
    [guruId, classId, tanggal, materi, jamMengajar],
  );
}

/** Rekap guru (dari identitas sesinya) pada periode uji. */
function rekapSendiri(guru) {
  return rekapGajiGuru(PERIODE, {
    id: guru.id,
    nama: guru.nama,
    email: guru.email,
  });
}

/** Baris rekap owner untuk satu guru; gagal kalau gurunya tidak ikut direkap. */
async function barisOwner(guruId) {
  const rekap = await rekapGajiAnyBulanan(PERIODE);
  assert.equal(rekap.periode, PERIODE);
  const baris = rekap.daftar.find((item) => item.guruId === guruId);
  assert.ok(baris, "guru dengan jurnal seharusnya ikut direkap owner");
  return baris;
}

/**
 * Fixture satu guru dengan dua jurnal di periode uji (1,5 jam + 2 jam) dan
 * tarif yang sudah diatur sejak awal bulan.
 */
async function siapkanRekap() {
  await bersihkan();
  await bersihkanTarif();

  const guru = await buatGuru("Guru Rekap Periode");
  const kelas = await buatKelas({
    guruId: guru.id,
    label: "Kelas Rekap Periode",
    denganJadwal: false,
  });
  await jurnal(guru.id, kelas.id, `${PERIODE}-05`, 1.5, "Aljabar");
  await jurnal(guru.id, kelas.id, `${PERIODE}-19`, 2, "Geometri");
  await aturTarif(40_000, TARIF_AWAL);

  return { guru, kelas };
}

test("rekap guru dan rekap owner menyebut angka yang sama", async () => {
  const { guru, kelas } = await siapkanRekap();

  const sendiri = await rekapSendiri(guru);
  const owner = await barisOwner(guru.id);

  assert.equal(sendiri.tarifDiatur, true);
  assert.equal(sendiri.tarifPerJam, 40_000);
  assert.equal(sendiri.guru.guruId, guru.id);
  assert.equal(sendiri.guru.guruNama, guru.nama);
  assert.equal(sendiri.guru.jumlahJurnal, 2);
  assert.equal(sendiri.guru.totalJam, 3.5);
  assert.equal(sendiri.guru.totalGaji, 140_000);
  assert.equal(sendiri.guru.statusPembayaran, "belum_dibayar");
  assert.equal(sendiri.guru.tanggalDibayar, null);

  // Angka yang dipakai owner menandai pembayaran harus sama persis dengan yang
  // dilihat guru di halamannya sendiri.
  assert.deepEqual(
    {
      jumlahJurnal: owner.jumlahJurnal,
      totalJam: owner.totalJam,
      tarifPerJam: owner.tarifPerJam,
      totalGaji: owner.totalGaji,
      statusPembayaran: owner.statusPembayaran,
      tanggalDibayar: owner.tanggalDibayar,
      guruNama: owner.guruNama,
      guruEmail: owner.guruEmail,
    },
    {
      jumlahJurnal: sendiri.guru.jumlahJurnal,
      totalJam: sendiri.guru.totalJam,
      tarifPerJam: sendiri.guru.tarifPerJam,
      totalGaji: sendiri.guru.totalGaji,
      statusPembayaran: sendiri.guru.statusPembayaran,
      tanggalDibayar: sendiri.guru.tanggalDibayar,
      guruNama: sendiri.guru.guruNama,
      guruEmail: sendiri.guru.guruEmail,
    },
  );
  assert.equal(owner.tarifPerJam, sendiri.tarifPerJam);

  // Rinciannya juga sama: nama kelas, urutan tanggal, dan jam tiap sesi.
  assert.deepEqual(owner.rincian, sendiri.guru.rincian);
  assert.deepEqual(
    sendiri.guru.rincian.map((baris) => [baris.namaKelas, baris.jamMengajar]),
    [
      [kelas.nama, 1.5],
      [kelas.nama, 2],
    ],
  );

  await bersihkan();
  await bersihkanTarif();
});

test("tarif satu periode adalah tarif yang berlaku di akhir bulan itu", async () => {
  const { guru } = await siapkanRekap();

  // Tarif naik di tengah bulan. Kedua jurnalnya ditulis sebelum tanggal itu,
  // tetapi rekap satu bulan hanya punya satu tarif: yang berlaku di akhir
  // bulan, jadi seluruh bulan dihitung dengan tarif baru.
  await aturTarif(90_000, TARIF_NAIK);

  const naik = await rekapSendiri(guru);
  assert.equal(naik.tarifPerJam, 90_000);
  assert.equal(naik.guru.totalGaji, 315_000);
  assert.equal((await barisOwner(guru.id)).totalGaji, 315_000);

  // Tarif bulan berikutnya belum menyentuh bulan ini.
  await aturTarif(120_000, TARIF_BULAN_DEPAN);
  const tetap = await rekapSendiri(guru);
  assert.equal(tetap.tarifPerJam, 90_000);
  assert.equal(tetap.guru.totalGaji, 315_000);

  await bersihkan();
  await bersihkanTarif();
});

test("guru tanpa jurnal di periode itu terhitung nol, dan tidak muncul di rekap owner", async () => {
  await siapkanRekap();
  const tanpaJurnal = await buatGuru("Guru Tanpa Jurnal");

  const sendiri = await rekapSendiri(tanpaJurnal);
  assert.equal(sendiri.guru.jumlahJurnal, 0);
  assert.equal(sendiri.guru.totalJam, 0);
  assert.equal(sendiri.guru.totalGaji, 0);
  assert.deepEqual(sendiri.guru.rincian, []);
  assert.equal(sendiri.guru.statusPembayaran, "belum_dibayar");
  // Tarifnya tetap dilaporkan supaya layar bisa membedakan "belum ada jurnal"
  // dari "tarif belum diatur".
  assert.equal(sendiri.tarifDiatur, true);
  assert.equal(sendiri.tarifPerJam, 40_000);

  const rekap = await rekapGajiAnyBulanan(PERIODE);
  assert.equal(
    rekap.daftar.some((baris) => baris.guruId === tanpaJurnal.id),
    false,
    "guru tanpa jurnal tidak perlu muncul di daftar owner",
  );

  await bersihkan();
  await bersihkanTarif();
});

test("penandaan pembayaran tampil sama di rekap guru dan rekap owner", async () => {
  const { guru } = await siapkanRekap();

  const ditandai = await picuRekapHonor({
    guruId: guru.id,
    periode: PERIODE,
    dibayar: true,
  });
  assert.equal(ditandai.status, "tersimpan");
  assert.equal(ditandai.pembayaran.statusPembayaran, "dibayar");
  assert.ok(ditandai.pembayaran.tanggalDibayar);

  const sendiri = await rekapSendiri(guru);
  const owner = await barisOwner(guru.id);
  assert.equal(sendiri.guru.statusPembayaran, "dibayar");
  assert.equal(sendiri.guru.tanggalDibayar, ditandai.pembayaran.tanggalDibayar);
  assert.equal(owner.statusPembayaran, "dibayar");
  assert.equal(owner.tanggalDibayar, ditandai.pembayaran.tanggalDibayar);

  // Angka yang disalin saat pembayaran ditandai sama dengan angka rekapnya.
  assert.equal(ditandai.pembayaran.totalJam, sendiri.guru.totalJam);
  assert.equal(ditandai.pembayaran.tarifPerJam, sendiri.guru.tarifPerJam);
  assert.equal(ditandai.pembayaran.totalGaji, sendiri.guru.totalGaji);

  // Membatalkan pembayaran mengosongkan lagi tanggal bayarnya di kedua rekap.
  await picuRekapHonor({ guruId: guru.id, periode: PERIODE, dibayar: false });
  assert.equal(
    (await rekapSendiri(guru)).guru.statusPembayaran,
    "belum_dibayar",
  );
  assert.equal((await rekapSendiri(guru)).guru.tanggalDibayar, null);
  const setelahBatal = await barisOwner(guru.id);
  assert.equal(setelahBatal.statusPembayaran, "belum_dibayar");
  assert.equal(setelahBatal.tanggalDibayar, null);

  await bersihkan();
  await bersihkanTarif();
});

// --- Kontrak masukannya ----------------------------------------------------
//
// Endpoint rekap gaji menerima periode dari query (`GET /api/gaji` dan
// `/api/admin/gaji`) dan, untuk penandaan pembayaran, satu paket JSON
// (`PATCH /api/admin/gaji`). Bentuk masukannya dijaga di satu tempat ini; yang
// dikunci di bawah adalah periode mana yang dianggap sah, karena periode yang
// salah tidak boleh diam-diam menghasilkan rekap bulan lain.

/** Kode masalah zod saat nilai ditolak; gagal kalau nilainya justru diterima. */
function ditolak(skema, nilai) {
  const hasil = skema.safeParse(nilai);
  assert.equal(hasil.success, false, `seharusnya ditolak: ${nilai}`);
  return hasil.error.issues[0].code;
}

test("periode rekap gaji hanya menerima bulan YYYY-MM yang sah", () => {
  assert.deepEqual(periodeGajiSchema.parse({ periode: "2096-03" }), {
    periode: "2096-03",
  });
  // Tanpa periode berarti bulan berjalan; rutenya yang mengisi bawaannya.
  assert.deepEqual(periodeGajiSchema.parse({}), {});

  for (const salah of [
    "",
    "2096-3",
    "2096-13",
    "2096-00",
    "2096-03-01",
    "Maret",
  ]) {
    assert.equal(
      ditolak(periodeGajiSchema, { periode: salah }),
      "invalid_format",
      `periode ${JSON.stringify(salah)} seharusnya ditolak`,
    );
  }
  assert.equal(ditolak(periodeGajiSchema, { periode: null }), "invalid_type");
  assert.equal(
    ditolak(periodeGajiSchema, { periode: "2096-03", bulan: "03" }),
    "unrecognized_keys",
  );
});

test("penandaan pembayaran wajib menyebut guru, periode, dan statusnya", () => {
  assert.deepEqual(
    ubahPembayaranGajiSchema.parse({
      guruId: "guru-uji-1",
      periode: "2096-03",
      dibayar: false,
    }),
    { guruId: "guru-uji-1", periode: "2096-03", dibayar: false },
  );

  // `dibayar` harus boolean sungguhan: teks "true" akan tersimpan sebagai
  // status yang tidak pernah dibaca perbandingan di layanan.
  assert.equal(
    ditolak(ubahPembayaranGajiSchema, {
      guruId: "guru-uji-1",
      periode: "2096-03",
      dibayar: "true",
    }),
    "invalid_type",
  );
  assert.equal(
    ditolak(ubahPembayaranGajiSchema, {
      guruId: "",
      periode: "2096-03",
      dibayar: true,
    }),
    "too_small",
  );
  assert.equal(
    ditolak(ubahPembayaranGajiSchema, {
      guruId: "guru-uji-1",
      periode: "2096-3",
      dibayar: true,
    }),
    "invalid_format",
  );
  assert.equal(
    ditolak(ubahPembayaranGajiSchema, {
      guruId: "guru-uji-1",
      periode: "2096-03",
      dibayar: true,
      totalGaji: 0,
    }),
    "unrecognized_keys",
  );
});
