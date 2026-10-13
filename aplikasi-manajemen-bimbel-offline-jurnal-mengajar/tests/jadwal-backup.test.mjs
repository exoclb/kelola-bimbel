// Uji penyimpanan pengaturan jadwal backup (tabel `backup_settings` beserta
// `ambilJadwalBackup`/`simpanJadwalBackup` di src/services/backup.service.ts):
// jadwal bawaan saat tabelnya masih kosong, penyimpanan yang memperbarui baris
// tunggal itu (bukan menumpuk baris baru), dan batasan tabelnya yang menahan
// jam, retensi, serta tempat penyimpanan yang tidak masuk akal. Aturan
// validator `jadwalBackupSchema` diuji di sini juga karena formulir dan
// penjadwal memakai aturan yang sama.
//
// Alias "@/..." milik tsconfig diterjemahkan penerjemah bersama di
// tests/dukungan/impor-ts.mjs. `npm test` mengaktifkan kondisi `react-server`
// sehingga modul ber-"server-only" boleh diimpor, dan basis data ujinya
// disiapkan scripts/test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

pasangImporTs();

const { ambilJadwalBackup, simpanJadwalBackup } =
  await import("../src/services/backup.service.ts");
const { JADWAL_BACKUP_BAWAAN } = await import("../src/lib/jadwal-backup.ts");
const { jadwalBackupSchema } = await import("../src/validators/pengaturan.ts");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

/** Pengaturan uji yang sah; tiap tes menimpanya seperlunya. */
const JADWAL_UJI = {
  aktif: false,
  jam: "03:15",
  zonaWaktu: "Asia/Makassar",
  retensiHari: 14,
  tujuan: "/srv/cadangan/bimbel",
};

/** Kembalikan tabelnya ke keadaan sebelum uji: kosong, tanpa baris sisa. */
async function bersihkan() {
  await pool.query("DELETE FROM backup_settings");
}

test.beforeEach(bersihkan);
test.after(async () => {
  await bersihkan();
  await pool.end();
});

/** Baris `backup_settings` yang benar-benar ada di tabel, dibaca langsung. */
async function barisTersimpan() {
  const { rows } = await pool.query(
    "SELECT aktif, jam, zona_waktu, retensi_hari, tujuan FROM backup_settings",
  );
  return rows;
}

/**
 * Tanpa baris tersimpan, halaman dan penjadwal tetap mendapat jadwal yang
 * berlaku — bukan pengaturan kosong.
 */
test("jadwal bawaan dipakai selama pengaturan belum pernah disimpan", async () => {
  assert.deepEqual(await ambilJadwalBackup(), JADWAL_BACKUP_BAWAAN);
  assert.deepEqual(await barisTersimpan(), []);
});

/**
 * Bacaan tidak menulis apa pun: tabelnya baru terisi setelah simpan dipanggil,
 * dan yang dibaca kembali adalah nilai yang barusan disimpan.
 */
test("menyimpan pengaturan membuat barisnya lalu membacanya kembali", async () => {
  const tersimpan = await simpanJadwalBackup(JADWAL_UJI);

  assert.deepEqual(tersimpan, JADWAL_UJI);
  assert.deepEqual(await ambilJadwalBackup(), JADWAL_UJI);
  assert.deepEqual(await barisTersimpan(), [
    {
      aktif: false,
      jam: "03:15",
      zona_waktu: "Asia/Makassar",
      retensi_hari: 14,
      tujuan: "/srv/cadangan/bimbel",
    },
  ]);
});

/**
 * Pengaturan cuma boleh satu baris: simpan kedua memperbarui baris yang ada,
 * mengembalikan isinya, dan jumlah barisnya tetap satu.
 */
test("menyimpan ulang memperbarui baris tunggal, bukan menambah baris baru", async () => {
  await simpanJadwalBackup(JADWAL_UJI);

  const diubah = {
    ...JADWAL_UJI,
    aktif: true,
    jam: "23:45",
    retensiHari: 90,
    tujuan: "/srv/cadangan/lain",
  };
  const tersimpan = await simpanJadwalBackup(diubah);

  assert.deepEqual(tersimpan, diubah);
  assert.deepEqual(await ambilJadwalBackup(), diubah);
  assert.equal((await barisTersimpan()).length, 1);
});

/**
 * Nilai bawaan kolom tabelnya dan `JADWAL_BACKUP_BAWAAN` harus sama, supaya
 * pengaturan yang belum diisi tidak terbaca berbeda tergantung dari mana
 * dibacanya.
 */
test("bawaan kolom basis data sama dengan jadwal bawaan aplikasi", async () => {
  const { rows } = await pool.query(
    `INSERT INTO backup_settings DEFAULT VALUES
     RETURNING aktif, jam, zona_waktu, retensi_hari, tujuan`,
  );

  assert.deepEqual(rows[0], {
    aktif: JADWAL_BACKUP_BAWAAN.aktif,
    jam: JADWAL_BACKUP_BAWAAN.jam,
    zona_waktu: JADWAL_BACKUP_BAWAAN.zonaWaktu,
    retensi_hari: JADWAL_BACKUP_BAWAAN.retensiHari,
    tujuan: JADWAL_BACKUP_BAWAAN.tujuan,
  });
});

/**
 * Batasan tabel menahan nilai yang tidak masuk akal walau ada yang menulisnya
 * langsung ke basis data, sehingga penjadwal tidak pernah membaca jam, retensi,
 * atau tempat penyimpanan yang salah bentuk.
 */
test("basis data menolak jam, retensi, dan tujuan yang tidak sah", async () => {
  const coba = async (values) => {
    const { rows } = await pool.query(
      `INSERT INTO backup_settings (jam, retensi_hari, zona_waktu, tujuan)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      values,
    );
    return rows[0];
  };

  // Kolomnya ditulis sebagai pasangan supaya tiap kasus hanya berbeda di satu
  // nilai: yang lain tetap sah.
  const sah = ["03:15", 14, "Asia/Makassar", "/srv/cadangan/bimbel"];
  const kasus = [
    { kolom: 0, nilai: "3:15" },
    { kolom: 0, nilai: "24:00" },
    { kolom: 0, nilai: "03:60" },
    { kolom: 1, nilai: 0 },
    { kolom: 1, nilai: 366 },
    { kolom: 2, nilai: "   " },
    { kolom: 3, nilai: "cadangan" },
  ];

  for (const { kolom, nilai } of kasus) {
    const values = [...sah];
    values[kolom] = nilai;
    await assert.rejects(
      () => coba(values),
      (galat) => galat.code === "23514",
      `nilai ${JSON.stringify(nilai)} seharusnya ditolak batasan tabel`,
    );
  }

  // Sebagai pembanding: isian yang sah memang tersimpan.
  await assert.doesNotReject(() => coba(sah));
});

/** Baris kedua ditolak indeks uniknya, jadi pengaturannya tetap tunggal. */
test("basis data menolak pengaturan backup kedua", async () => {
  await simpanJadwalBackup(JADWAL_UJI);

  await assert.rejects(
    () =>
      pool.query(
        `INSERT INTO backup_settings (jam, retensi_hari, zona_waktu, tujuan)
         VALUES ('04:00', 7, 'Asia/Jakarta', '/srv/cadangan/lain')`,
      ),
    (galat) => galat.code === "23505",
  );
});

/**
 * Validator memakai aturan yang sama dengan formulir: jam 24 jam, zona waktu
 * yang dikenal, retensi 1–365 hari, dan tempat penyimpanan yang absolut.
 */
test("validator jadwal menerima isian lengkap dan menolak yang salah", () => {
  assert.deepEqual(jadwalBackupSchema.parse(JADWAL_UJI), JADWAL_UJI);
  assert.equal(
    jadwalBackupSchema.parse({ ...JADWAL_UJI, tujuan: " /srv/x " }).tujuan,
    "/srv/x",
  );

  const ditolak = [
    { ...JADWAL_UJI, jam: "3:15" },
    { ...JADWAL_UJI, jam: "25:00" },
    { ...JADWAL_UJI, zonaWaktu: "Asia/Jakartaa" },
    { ...JADWAL_UJI, zonaWaktu: " " },
    { ...JADWAL_UJI, retensiHari: 0 },
    { ...JADWAL_UJI, retensiHari: 366 },
    { ...JADWAL_UJI, retensiHari: 7.5 },
    { ...JADWAL_UJI, tujuan: "cadangan" },
    { ...JADWAL_UJI, tujuan: " " },
    { ...JADWAL_UJI, aktif: "ya" },
  ];

  for (const nilai of ditolak) {
    assert.equal(
      jadwalBackupSchema.safeParse(nilai).success,
      false,
      `${JSON.stringify(nilai)} seharusnya ditolak validator`,
    );
  }

  // Kunci asing tidak ikut tersimpan diam-diam.
  assert.equal(
    jadwalBackupSchema.safeParse({ ...JADWAL_UJI, cron: "0 2 * * *" }).success,
    false,
  );
});
