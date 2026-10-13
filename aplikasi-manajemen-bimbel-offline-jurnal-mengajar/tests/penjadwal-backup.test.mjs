// Uji penjadwal backup otomatis (src/services/penjadwal-backup.service.ts).
// Ketiga hal yang bisa salah di sini diuji terpisah:
// - `penjadwalDiizinkan`: saklar PENJADWAL_BACKUP, bawaannya hidup.
// - `periksaJadwalDanJalankan`: kapan backup dijalankan, dilewati, atau
//   ditunda — diuji dengan jadwal, catatan, dan pelaksana buatan sehingga tidak
//   perlu basis data, pg_dump, maupun jam mesin yang sungguhan.
// - `mulaiPenjadwalBackup`: hanya satu penjadwal per proses, tiknya berjalan,
//   dan penghentiannya bekerja.
//
// Alias "@/..." milik tsconfig diterjemahkan penerjemah bersama di
// tests/dukungan/impor-ts.mjs. `npm test` mengaktifkan kondisi `react-server`
// sehingga modul ber-"server-only" boleh diimpor.
import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as tungguGiliran } from "node:timers/promises";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

pasangImporTs();

const {
  BATAS_BERJALAN_MS,
  JEDA_TIK_MS,
  VARIABEL_PENJADWAL,
  hentikanPenjadwalBackup,
  mulaiPenjadwalBackup,
  penjadwalDiizinkan,
  periksaJadwalDanJalankan,
} = await import("../src/services/penjadwal-backup.service.ts");

const { JADWAL_BACKUP_BAWAAN } = await import("../src/lib/jadwal-backup.ts");

/** Jadwal harian pukul 02:00 WIB, sama dengan bawaan aplikasi. */
const jadwal = { ...JADWAL_BACKUP_BAWAAN };

/** Catatan backup tiruan; `mulai` diisi waktu yang diminta tes. */
const catatan = (status, mulai, tambahan = {}) => ({
  id: "00000000-0000-0000-0000-000000000000",
  mulai,
  selesai: status === "berjalan" ? null : mulai,
  status,
  ukuranByte: status === "sukses" ? 1024 : null,
  lokasi: status === "sukses" ? "/var/backups/kelola/contoh.dump" : null,
  pesan: status === "gagal" ? "dump gagal" : null,
  ...tambahan,
});

/**
 * Opsi pemeriksaan dengan sumber-sumber buatan. `dijalankan` menghitung berapa
 * kali backupnya benar-benar dijalankan supaya tes bisa memastikan penjadwal
 * tidak memicunya berkali-kali.
 */
function opsi(sekarang, terakhir, tambahan = {}) {
  const dijalankan = [];
  return {
    opsi: {
      sekarang,
      bacaJadwal: async () => jadwal,
      bacaCatatanTerakhir: async () => terakhir,
      jalankan: async () => {
        dijalankan.push(sekarang);
        return catatan("sukses", sekarang ?? new Date());
      },
      ...tambahan,
    },
    dijalankan,
  };
}

test("penjadwal hidup secara bawaan dan hanya mati kalau dimatikan tegas", () => {
  assert.equal(JEDA_TIK_MS, 60_000);
  assert.equal(penjadwalDiizinkan({}), true);
  assert.equal(penjadwalDiizinkan({ [VARIABEL_PENJADWAL]: "" }), true);
  assert.equal(penjadwalDiizinkan({ [VARIABEL_PENJADWAL]: "  " }), true);
  for (const isian of ["aktif", "ON", "true", "1", "ya", " yes "])
    assert.equal(
      penjadwalDiizinkan({ [VARIABEL_PENJADWAL]: isian }),
      true,
      `"${isian}" seharusnya menyalakan penjadwal`,
    );
  for (const isian of ["nonaktif", "OFF", "false", "0", "tidak", " no "])
    assert.equal(
      penjadwalDiizinkan({ [VARIABEL_PENJADWAL]: isian }),
      false,
      `"${isian}" seharusnya mematikan penjadwal`,
    );
  // Salah ketik tidak boleh diam-diam menghilangkan backupnya.
  for (const isian of ["naktif", "mantap", "kosong"])
    assert.equal(
      penjadwalDiizinkan({ [VARIABEL_PENJADWAL]: isian }),
      true,
      `"${isian}" bukan perintah mematikan, jadi penjadwalnya tetap hidup`,
    );
});

test("jadwal yang dimatikan tidak pernah menjalankan backup", async () => {
  const { opsi: o, dijalankan } = opsi(
    new Date("2026-03-10T05:00:00.000Z"),
    null,
    { bacaJadwal: async () => ({ ...jadwal, aktif: false }) },
  );
  assert.deepEqual(await periksaJadwalDanJalankan(o), {
    status: "dimatikan",
  });
  assert.equal(dijalankan.length, 0);
});

test("pemasangan baru menunggu jam jadwalnya, bukan langsung backup", async () => {
  // Belum ada catatan sama sekali, dan jadwal hari ini belum lewat.
  const { opsi: o, dijalankan } = opsi(
    new Date("2026-03-10T18:00:00.000Z"), // 11 Maret 01.00 WIB, sebelum pukul 02.00
    null,
  );
  const hasil = await periksaJadwalDanJalankan(o);
  assert.equal(hasil.status, "belum_jatuh_tempo");
  assert.equal(dijalankan.length, 0);
  // Acuannya jadwal berikutnya — 11 Maret 02.00 WIB — bukan slot kemarin.
  assert.equal(
    hasil.jatuhTempo.toISOString(),
    "2026-03-10T19:00:00.000Z",
    "yang ditunggu seharusnya jadwal 11 Maret 02.00 WIB",
  );
});

test("pemasangan baru tetap menunggu walau jam jadwalnya sudah lewat", async () => {
  // Tanpa catatan sama sekali, dump pertama menunggu jadwal berikutnya: server
  // pengembangan yang belum punya pg_dump tidak menumpuk catatan gagal.
  const { opsi: o, dijalankan } = opsi(
    new Date("2026-03-10T03:00:00.000Z"), // 10 Maret 10.00 WIB
    null,
  );
  const hasil = await periksaJadwalDanJalankan(o);
  assert.equal(hasil.status, "belum_jatuh_tempo");
  assert.equal(
    hasil.jatuhTempo.toISOString(),
    "2026-03-10T19:00:00.000Z", // 11 Maret 02.00 WIB
  );
  assert.equal(dijalankan.length, 0);
});

test("slot yang sudah lewat dan belum dikerjakan langsung dijalankan", async () => {
  // 10 Maret 09.30 WIB: jadwal pukul 02.00 sudah lewat, catatan terakhir dua
  // hari lalu.
  const sekarang = new Date("2026-03-10T02:30:00.000Z");
  const { opsi: o, dijalankan } = opsi(
    sekarang,
    catatan("sukses", new Date("2026-03-08T19:00:00.000Z")),
  );
  const hasil = await periksaJadwalDanJalankan(o);
  assert.equal(hasil.status, "dijalankan");
  assert.equal(hasil.backup.status, "sukses");
  assert.deepEqual(
    dijalankan,
    [sekarang],
    "dijalankan sekali dengan waktu itu",
  );
});

test("slot yang sudah dikerjakan tidak diulang walau catatannya gagal", async () => {
  // Catatan terakhir pukul 02.05 WIB hari ini — sudah melewati jadwalnya.
  const { opsi: o, dijalankan } = opsi(
    new Date("2026-03-10T05:00:00.000Z"),
    catatan("gagal", new Date("2026-03-09T19:05:00.000Z")),
  );
  const hasil = await periksaJadwalDanJalankan(o);
  assert.equal(hasil.status, "belum_jatuh_tempo");
  assert.equal(dijalankan.length, 0);
});

test("backup yang sedang berjalan tidak ditumpuk penjadwal", async () => {
  const sekarang = new Date("2026-03-10T05:00:00.000Z");
  const { opsi: o, dijalankan } = opsi(
    sekarang,
    catatan("berjalan", new Date(sekarang.getTime() - 60_000)),
  );
  const hasil = await periksaJadwalDanJalankan(o);
  assert.equal(hasil.status, "sedang_berjalan");
  assert.equal(dijalankan.length, 0);
});

test("baris berjalan yang menggantung tidak menghentikan penjadwal", async () => {
  // 11 Maret 02.30 WIB: jadwal hari ini sudah lewat, dan baris `berjalan` dari
  // lebih dari enam jam lalu sudah pasti sisa proses yang mati.
  const sekarang = new Date("2026-03-10T19:30:00.000Z");
  const menggantung = new Date(sekarang.getTime() - BATAS_BERJALAN_MS - 1);
  const { opsi: o, dijalankan } = opsi(
    sekarang,
    catatan("berjalan", menggantung),
  );
  const hasil = await periksaJadwalDanJalankan(o);
  assert.equal(hasil.status, "dijalankan");
  assert.equal(dijalankan.length, 1);
});

test("penjadwal memakai waktu sekarang kalau tidak diberi acuan", async () => {
  // Tanpa `sekarang`, acuannya jam mesin saat uji berjalan: hasilnya boleh salah
  // satu dari dua keadaan yang sah, yang penting bukan galat.
  const { opsi: o } = opsi(undefined, null);
  const hasil = await periksaJadwalDanJalankan(o);
  assert.ok(["belum_jatuh_tempo", "dijalankan"].includes(hasil.status));
});

test("penjadwal jalan tiap jeda, tik pertama tidak menunggu, dan berhenti bersih", async () => {
  const dipanggil = [];
  const catatanLog = [];
  // Jedanya sengaja jauh lebih panjang daripada waktu tunggu tes, jadi
  // "tik pertama tidak menunggu jeda" bisa dibedakan dari "tik berkala".
  const penjadwal = mulaiPenjadwalBackup({
    sumber: {},
    jedaMs: 300,
    periksa: async () => {
      dipanggil.push(new Date());
      return { status: "belum_jatuh_tempo", jatuhTempo: new Date(0) };
    },
    catat: (pesan) => catatanLog.push(pesan),
  });
  try {
    assert.ok(penjadwal, "penjadwal seharusnya menyala");
    // Penjadwal kedua tidak boleh jalan: satu proses, satu timer.
    assert.equal(
      mulaiPenjadwalBackup({
        sumber: {},
        jedaMs: 5,
        periksa: async () => {
          throw new Error("penjadwal kedua tidak seharusnya jalan");
        },
      }),
      null,
    );

    await tungguGiliran();
    assert.equal(
      dipanggil.length,
      1,
      "tik pertama jalan tanpa menunggu satu jeda penuh",
    );

    await new Promise((lanjut) => setTimeout(lanjut, 350));
    assert.ok(dipanggil.length > 1, "tik berikutnya jalan berkala");
    assert.match(catatanLog[0], /Penjadwal backup aktif/);

    penjadwal.hentikan();
    const jumlahSebelumBerhenti = dipanggil.length;
    await new Promise((lanjut) => setTimeout(lanjut, 400));
    assert.equal(dipanggil.length, jumlahSebelumBerhenti, "timer sudah mati");

    // Setelah dihentikan, penjadwal boleh dinyalakan lagi.
    const lagi = mulaiPenjadwalBackup({
      sumber: {},
      jedaMs: 1000,
      periksa: async () => ({ status: "dimatikan" }),
      catat: () => {},
    });
    assert.ok(lagi, "penjadwal bisa dinyalakan ulang setelah dihentikan");
  } finally {
    hentikanPenjadwalBackup();
  }
});

test("saklar nonaktif membuat penjadwal tidak jalan sama sekali", async () => {
  const catatanLog = [];
  const penjadwal = mulaiPenjadwalBackup({
    sumber: { [VARIABEL_PENJADWAL]: "nonaktif" },
    jedaMs: 5,
    periksa: async () => {
      throw new Error("periksa tidak seharusnya dipanggil");
    },
    catat: (pesan) => catatanLog.push(pesan),
  });
  assert.equal(penjadwal, null);
  assert.deepEqual(catatanLog, []);
});

test("tik yang gagal dicatat dan penjadwalnya tetap hidup", async () => {
  const catatanLog = [];
  let panggilan = 0;
  const penjadwal = mulaiPenjadwalBackup({
    sumber: {},
    jedaMs: 5,
    periksa: async () => {
      panggilan += 1;
      if (panggilan === 1) throw new Error("basis data sedang mati");
      return { status: "dimatikan" };
    },
    catat: (pesan) => catatanLog.push(pesan),
  });
  try {
    await new Promise((lanjut) => setTimeout(lanjut, 40));
    assert.ok(panggilan > 1, "tik berikutnya tetap jalan setelah gagal");
    assert.ok(
      catatanLog.some((pesan) => pesan.includes("basis data sedang mati")),
      "galatnya dicatat supaya terlihat di log server",
    );
  } finally {
    penjadwal?.hentikan();
  }
});
