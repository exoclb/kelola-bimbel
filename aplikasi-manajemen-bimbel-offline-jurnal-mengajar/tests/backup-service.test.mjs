// Uji penjalanan backup di lapisan layanan (src/services/backup.service.ts):
// pembacaan pengaturannya, urutan pencatatannya (`berjalan` ditulis lebih dulu),
// dan penutupan baris itu menjadi `sukses` atau `gagal` beserta alasannya.
// Pelaksana perintah diganti di sebagian tes supaya pengujian tidak menuntut
// `pg_dump` terpasang; dua tes terakhir memakai pelaksana sungguhannya dengan
// perintah Node kecil sebagai pengganti dump.
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
  bacaKonfigurasiBackup,
  jalankanBackupDanCatat,
  jalankanPerintahDump,
  namaBerkasBackup,
  VARIABEL_BACKUP,
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
  assert.ok(existsSync(hasil.berkas), "direktori backup dibuat sendiri");

  const catatan = await barisCatatan(hasil.id);
  assert.equal(catatan.status, "sukses");
  assert.equal(catatan.ukuran_byte, 12);
  assert.equal(catatan.lokasi, hasil.berkas);
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
