// Uji penjalanan backup di lapisan layanan (src/services/backup.service.ts):
// pembacaan pengaturannya, urutan pencatatannya (`berjalan` ditulis lebih dulu),
// penutupan baris itu menjadi `sukses` atau `gagal` beserta alasannya,
// penyaringan berkas yang siap diuji pemulihan (`ambilBerkasBackupUji`), dan
// pemulihan berkas salinan ke database percobaan (`pulihkanBerkasBackup`) yang
// menolak menyentuh database aplikasi.
// Pelaksana perintah diganti di sebagian tes supaya pengujian tidak menuntut
// `pg_dump` maupun `pg_restore` terpasang; tes terakhir bagian pemulihan serta
// dua tes backup memakai pelaksana sungguhannya dengan perintah Node kecil
// sebagai pengganti dump.
//
// Alias "@/..." milik tsconfig diterjemahkan penerjemah bersama di
// tests/dukungan/impor-ts.mjs. `npm test` mengaktifkan kondisi `react-server`
// sehingga modul ber-"server-only" boleh diimpor, dan basis data ujinya
// disiapkan scripts/test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { pasangImporTs } from "./dukungan/impor-ts.mjs";

pasangImporTs();

const {
  adaPemulihanBerjalan,
  ambilBerkasBackupUji,
  ambilBerkasBackupUjiById,
  bacaKonfigurasiBackup,
  bacaKonfigurasiPemulihan,
  jalankanBackupDanCatat,
  jalankanPerintahDump,
  jalankanPerintahPemulihan,
  namaBerkasBackup,
  namaDatabase,
  pulihkanBerkasBackup,
  VARIABEL_BACKUP,
  VARIABEL_PEMULIHAN,
} = await import("../src/services/backup.service.ts");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});

// Berkas uji ditulis ke direktori sementara sendiri; catatannya dihapus lewat
// `lokasi` yang menunjuk ke sana, jadi baris milik uji lain tidak tersentuh.
const tempat = mkdtempSync(join(tmpdir(), "uji-backup-"));
const berkasUji = (nama) => join(tempat, nama);

async function bersihkan() {
  await pool.query(
    "DELETE FROM backup_runs WHERE lokasi IS NOT NULL AND position($1 in lokasi) > 0",
    [tempat],
  );
}

test.after(async () => {
  await bersihkan();
  await pool.end();
  rmSync(tempat, { recursive: true, force: true });
});

/** Baris `backup_runs` yang barusan ditulis layanan, dibaca langsung dari tabel. */
async function barisCatatan(id) {
  const { rows } = await pool.query(
    "SELECT status, mulai, selesai, ukuran_byte::int AS ukuran_byte, lokasi, pesan FROM backup_runs WHERE id = $1",
    [id],
  );
  return rows[0];
}

/** Pengaturan uji dengan semua kolom terisi dan pelaksana palsu yang dicatat. */
function konfigurasiUji(direktori, tambahan = {}) {
  return {
    perintah: "perintah-dump-palsu",
    direktori,
    pakaiBerkas: false,
    variabelBermasalah: [],
    ...tambahan,
  };
}

/** Pengaturan uji pemulihan yang sudah lengkap dan menunjuk database percobaan. */
function konfigurasiPemulihanUji(tambahan = {}) {
  return {
    perintah: "pg_restore -d kelola_restore",
    databaseTujuan: "kelola_restore",
    pakaiBerkas: false,
    variabelBermasalah: [],
    bahaya: null,
    ...tambahan,
  };
}

test("pengaturan backup dibaca dari variabel lingkungan yang sama dengan skrip", () => {
  const bawaan = bacaKonfigurasiBackup({
    [VARIABEL_BACKUP.perintah]: "docker exec -i db pg_dump -Fc",
    [VARIABEL_BACKUP.direktori]: "/var/backups/kelola",
  });
  assert.equal(bawaan.perintah, "docker exec -i db pg_dump -Fc");
  assert.equal(bawaan.pakaiBerkas, false);
  assert.equal(bawaan.variabelBermasalah.length, 0);
  assert.ok(bawaan.direktori.endsWith("kelola"), bawaan.direktori);

  // Perintah yang menulis ke berkas tujuan sendiri dikenali dari `{file}`.
  const pakaiBerkas = bacaKonfigurasiBackup({
    [VARIABEL_BACKUP.perintah]: "pg_dump -f {file}",
  });
  assert.equal(pakaiBerkas.pakaiBerkas, true);
});

test("tanpa BACKUP_COMMAND perintah bawaannya memakai DATABASE_URL", () => {
  const siap = bacaKonfigurasiBackup({
    DATABASE_URL: "postgres://db/bimbel",
  });
  assert.match(siap.perintah, /^pg_dump -Fc /);
  assert.match(siap.perintah, /postgres:\/\/db\/bimbel/);
  assert.equal(siap.variabelBermasalah.length, 0);
  assert.ok(siap.direktori.endsWith("backups"), siap.direktori);

  // Tanpa keduanya tidak ada perintah yang bisa dijalankan, dan itu dilaporkan
  // sebagai variabel bermasalah supaya bisa dicatat sebagai alasan kegagalan.
  const kosong = bacaKonfigurasiBackup({});
  assert.deepEqual(kosong.variabelBermasalah, ["DATABASE_URL"]);
});

test("nama berkas backup mengikuti waktu setempat", () => {
  assert.equal(
    namaBerkasBackup(new Date(2026, 9, 13, 2, 0, 0)),
    "20261013-020000.dump",
  );
  assert.equal(
    namaBerkasBackup(new Date(2026, 0, 5, 23, 59, 9)),
    "20260105-235909.dump",
  );
});

test("baris berjalan ditulis sebelum perintahnya jalan, lalu ditutup sukses", async () => {
  await bersihkan();
  const direktori = berkasUji(join("sukses", "dalam"));
  let saatJalan = null;
  let dipanggil = null;

  const hasil = await jalankanBackupDanCatat({
    sekarang: new Date(2026, 9, 13, 2, 0, 0),
    konfigurasi: konfigurasiUji(direktori),
    pelaksana: async (perintah, berkas) => {
      dipanggil = { perintah, berkas };
      // Perintahnya baru mulai; barisnya harus sudah ada dan masih `berjalan`.
      const { rows } = await pool.query(
        "SELECT id, status, lokasi FROM backup_runs ORDER BY mulai DESC, id DESC LIMIT 1",
      );
      saatJalan = rows[0];
      writeFileSync(berkas, "salinan-dump");
      return { galat: null, ukuranByte: 12 };
    },
  });

  assert.equal(
    saatJalan?.status,
    "berjalan",
    "baris `berjalan` harus ada saat dump dimulai",
  );
  assert.equal(saatJalan?.lokasi, null, "lokasi baru diisi saat ditutup");
  assert.equal(
    saatJalan?.id,
    hasil.id,
    "baris yang dibuka itulah yang ditutup",
  );
  assert.deepEqual(dipanggil, {
    perintah: "perintah-dump-palsu",
    berkas: join(direktori, "20261013-020000.dump"),
  });
  assert.equal(hasil.status, "sukses");
  assert.equal(hasil.ukuranByte, 12);
  assert.equal(hasil.pesan, null);
  assert.ok(existsSync(hasil.lokasi), "direktori backup dibuat sendiri");
  assert.ok(hasil.mulai instanceof Date, "waktu mulainya ikut dikembalikan");
  assert.ok(
    hasil.selesai instanceof Date,
    "status selain berjalan punya waktu selesai",
  );

  // Yang dikembalikan adalah baris yang benar-benar tersimpan di tabel.
  const catatan = await barisCatatan(hasil.id);
  assert.equal(catatan.status, "sukses");
  assert.equal(catatan.ukuran_byte, 12);
  assert.equal(catatan.lokasi, hasil.lokasi);
  assert.equal(catatan.pesan, null);
  assert.ok(
    catatan.selesai instanceof Date,
    "status selain berjalan punya waktu selesai",
  );
});

test("perintah yang gagal menutup barisnya sebagai gagal beserta alasannya", async () => {
  await bersihkan();
  const hasil = await jalankanBackupDanCatat({
    konfigurasi: konfigurasiUji(berkasUji("gagal")),
    pelaksana: async () => ({
      galat: "pg_dump: error: connection to server failed",
      ukuranByte: null,
    }),
  });

  assert.equal(hasil.status, "gagal");
  assert.equal(hasil.ukuranByte, null);
  assert.match(hasil.pesan, /connection to server failed/);

  const catatan = await barisCatatan(hasil.id);
  assert.equal(catatan.status, "gagal");
  assert.equal(catatan.ukuran_byte, null);
  assert.ok(catatan.selesai instanceof Date);
  assert.match(catatan.pesan, /connection to server failed/);
});

test("pengaturan yang belum lengkap dicatat sebagai gagal tanpa menjalankan perintah", async () => {
  await bersihkan();
  let dijalankan = false;
  const hasil = await jalankanBackupDanCatat({
    konfigurasi: konfigurasiUji(berkasUji("belum-lengkap"), {
      variabelBermasalah: ["DATABASE_URL"],
    }),
    pelaksana: async () => {
      dijalankan = true;
      return { galat: null, ukuranByte: 1 };
    },
  });

  assert.equal(dijalankan, false);
  assert.equal(hasil.status, "gagal");
  assert.match(hasil.pesan, /DATABASE_URL belum diisi/);
  assert.equal((await barisCatatan(hasil.id)).status, "gagal");
});

test("pelaksana yang melempar galat tetap berakhir sebagai catatan gagal", async () => {
  await bersihkan();
  const hasil = await jalankanBackupDanCatat({
    konfigurasi: konfigurasiUji(berkasUji("melempar")),
    pelaksana: async () => {
      throw new Error("berkas tujuan tidak bisa ditulis");
    },
  });

  assert.equal(hasil.status, "gagal");
  assert.match(hasil.pesan, /tidak bisa ditulis/);
  assert.equal((await barisCatatan(hasil.id)).pesan, hasil.pesan);
});

test("alasan kegagalan dipotong sepanjang kolomnya", async () => {
  await bersihkan();
  const panjang = "x".repeat(900);
  const hasil = await jalankanBackupDanCatat({
    konfigurasi: konfigurasiUji(berkasUji("dipotong")),
    pelaksana: async () => ({ galat: panjang, ukuranByte: null }),
  });

  assert.equal(hasil.pesan.length, 500);
  assert.equal((await barisCatatan(hasil.id)).pesan.length, 500);
});

test("pelaksana sungguhan menyimpan stdout perintah ke berkas tujuan", async () => {
  const berkas = berkasUji("nyata.dump");
  const hasil = await jalankanPerintahDump(
    `"${process.execPath}" -e "process.stdout.write('dump-contoh')"`,
    berkas,
  );

  assert.equal(hasil.galat, null);
  assert.equal(hasil.ukuranByte, 11);
  assert.equal(readFileSync(berkas, "utf8"), "dump-contoh");
});

test("pelaksana sungguhan melaporkan keluaran galat dan perintah yang tidak ada", async () => {
  const gagal = await jalankanPerintahDump(
    `"${process.execPath}" -e "process.stderr.write('dump gagal: tabel rusak');process.exit(3)"`,
    berkasUji("nyata-gagal.dump"),
  );
  assert.match(gagal.galat, /dump gagal: tabel rusak/);
  assert.equal(gagal.ukuranByte, null);

  // Perintah yang tidak ada bukan galat Node yang menghentikan aplikasi, tapi
  // pesan yang bisa dibaca owner di halaman riwayat.
  const hilang = await jalankanPerintahDump(
    "perintah-dump-yang-tidak-ada --jalankan",
    berkasUji("nyata-hilang.dump"),
  );
  assert.ok(hilang.galat, "perintah yang tidak ada harus punya alasan");
  assert.equal(hilang.ukuranByte, null);
});

test("berkas kosong dianggap gagal walau perintahnya selesai normal", async () => {
  const kosong = await jalankanPerintahDump(
    `"${process.execPath}" -e "process.exit(0)"`,
    berkasUji("nyata-kosong.dump"),
  );

  assert.match(kosong.galat, /kosong/);
  assert.equal(kosong.ukuranByte, null);
});

test("perintah yang menulis sendiri ke {file} tidak disalurkan ulang", async () => {
  const berkas = berkasUji("nyata-berkas.dump");
  const hasil = await jalankanPerintahDump(
    `"${process.execPath}" -e "require('node:fs').writeFileSync(process.argv[1], 'salinan-berkas')" "{file}"`,
    berkas,
  );

  assert.equal(hasil.galat, null);
  assert.equal(hasil.ukuranByte, 14);
  assert.equal(readFileSync(berkas, "utf8"), "salinan-berkas");
});

/**
 * Daftar berkas yang siap diuji pemulihan: hanya catatan `sukses` yang sudah
 * punya lokasi berkas dan ukurannya, yang paling baru lebih dulu, dan bisa
 * dibatasi jumlahnya. Baris `gagal` — yang lokasinya bisa ikut terisi — dan
 * baris `berjalan` tidak pernah ikut jadi kandidat.
 */
test("daftar berkas uji pemulihan hanya memuat catatan sukses yang punya berkas", async () => {
  await bersihkan();
  const penanda = "daftar-berkas";
  const suksesLama = berkasUji(`${penanda}-lama.dump`);
  const suksesBaru = berkasUji(`${penanda}-baru.dump`);
  const gagal = berkasUji(`${penanda}-gagal.dump`);

  await pool.query(
    "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi) VALUES (now() - interval '3 hours', now() - interval '179 minutes', 'sukses', $1, $2)",
    [1024, suksesLama],
  );
  await pool.query(
    "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi) VALUES (now() - interval '1 hour', now() - interval '59 minutes', 'sukses', $1, $2)",
    [2048, suksesBaru],
  );
  await pool.query(
    "INSERT INTO backup_runs (mulai, selesai, status, lokasi, pesan) VALUES (now() - interval '2 hours', now() - interval '119 minutes', 'gagal', $1, $2)",
    [gagal, `Gagal menyalin (${penanda})`],
  );
  await pool.query(
    "INSERT INTO backup_runs (mulai, status) VALUES (now() - interval '30 minutes', 'berjalan')",
  );
  // Salinan lama dari versi sebelum `lokasi` selalu ikut terisi: statusnya
  // sukses tetapi berkasnya tidak diketahui, jadi tidak layak diuji.
  await pool.query(
    "INSERT INTO backup_runs (mulai, selesai, status) VALUES (now() - interval '4 hours', now() - interval '239 minutes', 'sukses')",
  );

  const berkas = await ambilBerkasBackupUji(50);
  const milikUji = berkas.filter((satu) => satu.lokasi.includes(penanda));
  assert.deepEqual(
    milikUji.map((satu) => satu.lokasi),
    [suksesBaru, suksesLama],
    "hanya yang sukses dan berberkas, yang paling baru lebih dulu",
  );
  assert.equal(milikUji[0].ukuranByte, 2048);
  assert.ok(
    milikUji[0].dibuat instanceof Date,
    "waktu pembuatan berkasnya ikut dikembalikan",
  );
  assert.equal(
    berkas.some((satu) => satu.lokasi === gagal),
    false,
    "berkas dari backup yang gagal bukan kandidat uji",
  );

  // Batas jumlahnya dihormati dan yang tersisa tetap yang paling baru.
  const dibatasi = await ambilBerkasBackupUji(1);
  assert.equal(dibatasi.length, 1);
  assert.equal(dibatasi[0].lokasi, suksesBaru);

  // Baris tanpa lokasi itu satu-satunya yang tidak tersentuh `bersihkan()`
  // (penghapusnya menyaring lewat `lokasi`), jadi dibuang di sini.
  await pool.query("DELETE FROM backup_runs WHERE lokasi IS NULL");
});

test("pengaturan pemulihan dibaca dari lingkungan dan menjaga database aplikasi", () => {
  const bawaan = bacaKonfigurasiPemulihan({
    [VARIABEL_PEMULIHAN.database]: "postgres://kelola@db:5432/kelola_restore",
    DATABASE_URL: "postgres://kelola@db:5432/kelola",
  });
  assert.equal(bawaan.databaseTujuan, "kelola_restore");
  assert.equal(bawaan.pakaiBerkas, false);
  assert.equal(
    bawaan.perintah,
    "pg_restore -d postgres://kelola@db:5432/kelola_restore",
  );
  assert.deepEqual(bawaan.variabelBermasalah, []);
  assert.equal(bawaan.bahaya, null);

  // Perintah yang menyebut berkas sumbernya sendiri dikenali, jadi pelaksana
  // tidak menambahkan path-nya lagi di belakang.
  const pakaiBerkas = bacaKonfigurasiPemulihan({
    [VARIABEL_PEMULIHAN.database]: "postgres://db/kelola_restore",
    [VARIABEL_PEMULIHAN.perintah]:
      "docker exec -i db pg_restore -d kelola_restore {file}",
  });
  assert.equal(pakaiBerkas.pakaiBerkas, true);

  // Tanpa RESTORE_DATABASE_URL perintahnya tidak lengkap: tujuannya tidak bisa
  // dipastikan, dan DATABASE_URL produksi tidak boleh dipakai sebagai gantinya.
  const kosong = bacaKonfigurasiPemulihan({
    DATABASE_URL: "postgres://db/kelola",
  });
  assert.deepEqual(kosong.variabelBermasalah, ["RESTORE_DATABASE_URL"]);
  assert.equal(kosong.databaseTujuan, null);

  // Tujuan yang sama dengan database aplikasi ditolak sebelum perintahnya jalan.
  const produksi = bacaKonfigurasiPemulihan({
    [VARIABEL_PEMULIHAN.database]: "postgres://db/kelola",
    DATABASE_URL: "postgres://db/kelola",
  });
  assert.match(produksi.bahaya, /sama dengan database yang dipakai aplikasi/);

  // Connection string yang tidak terbaca tidak boleh diam-diam dianggap aman.
  const rusak = bacaKonfigurasiPemulihan({
    [VARIABEL_PEMULIHAN.database]: "bukan-url",
  });
  assert.equal(rusak.databaseTujuan, null);
  assert.match(rusak.bahaya, /tidak terbaca sebagai connection string/);
});

test("nama database dibaca dari connection string", () => {
  assert.equal(
    namaDatabase("postgres://kelola:sandi@db:5432/kelola_restore"),
    "kelola_restore",
  );
  assert.equal(namaDatabase("postgres://db/"), null);
  assert.equal(namaDatabase(""), null);
  assert.equal(namaDatabase("bukan-url"), null);
});

test("pemulihan menolak tujuan yang menunjuk database aplikasi", async () => {
  const dipanggil = [];
  const pelaksana = async (perintah, berkas) => {
    dipanggil.push({ perintah, berkas });
    return null;
  };

  // Jalur normal: berkas yang diminta diteruskan ke perintahnya apa adanya.
  const lokasi = berkasUji("pulih-berhasil.dump");
  const berhasil = await pulihkanBerkasBackup({
    lokasi,
    pelaksana,
    konfigurasi: konfigurasiPemulihanUji(),
  });
  assert.equal(berhasil.berhasil, true);
  assert.equal(berhasil.pesan, null);
  assert.equal(berhasil.databaseTujuan, "kelola_restore");
  assert.equal(typeof berhasil.lamaMs, "number");
  assert.deepEqual(dipanggil, [
    { perintah: "pg_restore -d kelola_restore", berkas: lokasi },
  ]);

  // Tujuan yang sama dengan database aplikasi tidak pernah dijalankan.
  dipanggil.length = 0;
  const ditolak = await pulihkanBerkasBackup({
    lokasi: berkasUji("pulih-produksi.dump"),
    pelaksana,
    konfigurasi: konfigurasiPemulihanUji({
      bahaya:
        "Database tujuan pemulihan (kelola) sama dengan database yang dipakai aplikasi; pemulihan dibatalkan.",
    }),
  });
  assert.equal(ditolak.berhasil, false);
  assert.match(ditolak.pesan, /sama dengan database yang dipakai aplikasi/);

  // Pengaturan yang belum lengkap pun tidak menjalankan apa pun.
  const belumLengkap = await pulihkanBerkasBackup({
    lokasi: berkasUji("pulih-kosong.dump"),
    pelaksana,
    konfigurasi: konfigurasiPemulihanUji({
      variabelBermasalah: ["RESTORE_DATABASE_URL"],
    }),
  });
  assert.equal(belumLengkap.berhasil, false);
  assert.match(belumLengkap.pesan, /RESTORE_DATABASE_URL belum diisi/);
  assert.deepEqual(dipanggil, [], "perintahnya tidak dijalankan sama sekali");

  // Perintah yang melaporkan keluaran gagal dan perintah yang melempar galat
  // sama-sama berakhir sebagai hasil gagal beserta alasannya.
  const melaporkan = await pulihkanBerkasBackup({
    lokasi: berkasUji("pulih-gagal.dump"),
    pelaksana: async () => "hubungan ke database percobaan ditolak",
    konfigurasi: konfigurasiPemulihanUji(),
  });
  assert.equal(melaporkan.berhasil, false);
  assert.match(melaporkan.pesan, /hubungan ke database percobaan ditolak/);

  const melempar = await pulihkanBerkasBackup({
    lokasi: berkasUji("pulih-melempar.dump"),
    pelaksana: async () => {
      throw new Error("pg_restore tidak ditemukan");
    },
    konfigurasi: konfigurasiPemulihanUji(),
  });
  assert.equal(melempar.berhasil, false);
  assert.match(melempar.pesan, /pg_restore tidak ditemukan/);
});

test("hanya satu uji pemulihan yang berjalan sekaligus", async () => {
  let lepaskan;
  const ditahan = new Promise((selesai) => {
    lepaskan = selesai;
  });
  const pelaksana = () => ditahan.then(() => null);

  const pertama = pulihkanBerkasBackup({
    lokasi: berkasUji("pulih-berbarengan-1.dump"),
    pelaksana,
    konfigurasi: konfigurasiPemulihanUji(),
  });
  // Beri kesempatan uji pertama mengambil penandanya sebelum yang kedua datang.
  await new Promise((selesai) => setImmediate(selesai));
  assert.equal(adaPemulihanBerjalan(), true);

  const kedua = await pulihkanBerkasBackup({
    lokasi: berkasUji("pulih-berbarengan-2.dump"),
    pelaksana,
    konfigurasi: konfigurasiPemulihanUji(),
  });
  assert.equal(kedua.berhasil, false);
  assert.match(kedua.pesan, /masih ada uji pemulihan yang berjalan/i);

  lepaskan();
  assert.equal((await pertama).berhasil, true);
  assert.equal(
    adaPemulihanBerjalan(),
    false,
    "penandanya dilepas supaya uji berikutnya tidak tertahan",
  );

  const berikutnya = await pulihkanBerkasBackup({
    lokasi: berkasUji("pulih-berbarengan-3.dump"),
    pelaksana: async () => null,
    konfigurasi: konfigurasiPemulihanUji(),
  });
  assert.equal(berikutnya.berhasil, true);
});

test("berkas uji dipilih lewat id catatan backup, bukan path kiriman pemanggil", async () => {
  await bersihkan();
  const penanda = "pilih-berkas";
  const layak = berkasUji(`${penanda}-layak.dump`);
  const gagal = berkasUji(`${penanda}-gagal.dump`);

  const sukses = await pool.query(
    "INSERT INTO backup_runs (mulai, selesai, status, ukuran_byte, lokasi) VALUES (now() - interval '1 hour', now() - interval '59 minutes', 'sukses', $1, $2) RETURNING id",
    [4096, layak],
  );
  const gagalBaris = await pool.query(
    "INSERT INTO backup_runs (mulai, selesai, status, lokasi, pesan) VALUES (now() - interval '2 hours', now() - interval '119 minutes', 'gagal', $1, $2) RETURNING id",
    [gagal, `Gagal menyalin (${penanda})`],
  );
  const berjalan = await pool.query(
    "INSERT INTO backup_runs (mulai, status) VALUES (now() - interval '5 minutes', 'berjalan') RETURNING id",
  );
  // Salinan sukses dari versi lama: lokasinya tidak diketahui, jadi tidak layak.
  const tanpaLokasi = await pool.query(
    "INSERT INTO backup_runs (mulai, selesai, status) VALUES (now() - interval '3 hours', now() - interval '179 minutes', 'sukses') RETURNING id",
  );

  const dipilih = await ambilBerkasBackupUjiById(sukses.rows[0].id);
  assert.deepEqual(dipilih, {
    id: sukses.rows[0].id,
    lokasi: layak,
    dibuat: dipilih.dibuat,
    ukuranByte: 4096,
  });
  assert.ok(dipilih.dibuat instanceof Date);

  // Id yang tidak layak diuji maupun id asing tidak mengembalikan apa pun.
  for (const [sebutan, id] of [
    ["catatan gagal", gagalBaris.rows[0].id],
    ["catatan berjalan", berjalan.rows[0].id],
    ["catatan sukses tanpa lokasi", tanpaLokasi.rows[0].id],
    ["id asing", "00000000-0000-4000-8000-000000000000"],
  ]) {
    assert.equal(
      await ambilBerkasBackupUjiById(id),
      null,
      `${sebutan} tidak boleh jadi kandidat uji pemulihan`,
    );
  }

  await pool.query("DELETE FROM backup_runs WHERE lokasi IS NULL");
});

test("pemulihan sungguhan membaca berkas sumber dan melaporkan kegagalannya", async () => {
  const sumber = berkasUji("pulih-sumber.dump");
  const tujuan = berkasUji("pulih-hasil.txt");
  writeFileSync(sumber, "isi-salinan");

  // Perintah yang menyebut {file} menerima path berkas salinannya.
  const berhasil = await jalankanPerintahPemulihan(
    `"${process.execPath}" -e "require('node:fs').copyFileSync(process.argv[1], process.argv[2])" "{file}" "${tujuan}"`,
    sumber,
  );
  assert.equal(berhasil, null);
  assert.equal(readFileSync(tujuan, "utf8"), "isi-salinan");

  // Perintah yang tidak menyebut {file} tetap diberi berkas sumbernya; tujuan
  // hasilnya dikirim sebagai argumen supaya path Windows tidak masuk ke
  // potongan skrip dan terbaca sebagai deret escape.
  const tanpaPlaceholder = await jalankanPerintahPemulihan(
    `"${process.execPath}" -e "require('node:fs').appendFileSync(process.argv[1], require('node:fs').readFileSync(process.argv[2], 'utf8').toUpperCase())" "${tujuan}"`,
    sumber,
  );
  assert.equal(tanpaPlaceholder, null);
  assert.match(readFileSync(tujuan, "utf8"), /isi-salinanISI-SALINAN$/);

  // Perintah yang menolak berkasnya mengembalikan keluarannya sebagai alasan.
  const ditolak = await jalankanPerintahPemulihan(
    `"${process.execPath}" -e "process.stderr.write('database tujuan tidak ada');process.exit(1)" "{file}"`,
    sumber,
  );
  assert.match(ditolak, /database tujuan tidak ada/);
});
