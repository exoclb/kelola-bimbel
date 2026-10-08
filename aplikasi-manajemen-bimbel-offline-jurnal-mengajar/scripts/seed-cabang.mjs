// Mengisi tabel `cabang` dari data awal di `src/lib/mock-cabang.ts`: daftar
// cabang contoh yang namanya sudah dipakai kolom `cabang` pada data kelas.
// Seeder ini khusus lingkungan pengembangan — produksi memakai data cabang
// sungguhan lewat halaman pengaturan cabang — jadi dijalankan hanya saat
// NODE_ENV bukan `production` (atau dengan `--paksa` bila memang disengaja).
//
// Idempoten: nama cabang dijaga indeks unik tanpa membedakan huruf besar-kecil
// (`drizzle/0028_cabang_nama_unik.sql`), dan setiap penulisan memakai
// INSERT ... ON CONFLICT DO NOTHING. Menjalankan ulang skrip ini tidak
// menambah baris baru, jadi aman dipakai berkali-kali.
//
// Contoh:
//   npm run db:seed:cabang
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { loadEnvironment, root } from "./lib.mjs";
import { databaseError, databaseUrl } from "./postgres.mjs";

// Data awal dibaca langsung dari sumbernya supaya daftar cabang contoh di sini
// tidak pernah berbeda dari yang dipakai aplikasi. Node menjalankan TypeScript
// dengan menghapus tipe; hook di bawah menerjemahkan alias "@/..." milik
// tsconfig ke folder src supaya modul itu bisa diimpor skrip ini.
if (typeof registerHooks !== "function")
  throw new Error(
    "Skrip ini butuh Node.js 22.15 atau lebih baru (registerHooks).",
  );

const src = resolve(root, "src");
const AKHIRAN = ["", ".ts", ".tsx", "/index.ts"];

registerHooks({
  resolve(spesifier, konteks, lanjut) {
    if (spesifier.startsWith("@/")) {
      const dasar = resolve(src, spesifier.slice(2));
      for (const akhiran of AKHIRAN)
        if (existsSync(dasar + akhiran))
          return lanjut(pathToFileURL(dasar + akhiran).href, konteks);
    }
    return lanjut(spesifier, konteks);
  },
});

const { getDaftarCabang } = await import(
  pathToFileURL(resolve(src, "lib/mock-cabang.ts")).href
);

const paksa = process.argv.includes("--paksa");

/** Jumlah baris `cabang` beserta berapa yang aktif. */
async function jumlahBaris(klien) {
  const { rows } = await klien.query(
    `SELECT count(*)::int AS cabang,
            count(*) filter (where status_aktif)::int AS aktif
       FROM cabang`,
  );
  return rows[0];
}

function sebutJumlah(jumlah) {
  return `${jumlah.cabang} baris (${jumlah.aktif} aktif)`;
}

const hasil = { dibuat: 0, dilewati: 0 };

console.log("\nSeeder data awal cabang\n");

let pool;
try {
  if (process.env.NODE_ENV === "production" && !paksa)
    throw new Error(
      "Seeder data awal cabang hanya untuk lingkungan pengembangan. Data cabang sungguhan diisi lewat halaman pengaturan cabang; tambahkan --paksa kalau memang ingin mengisi data contoh di lingkungan ini.",
    );

  await loadEnvironment();
  pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", () => {});

  const daftar = getDaftarCabang();
  // Nama kembar tidak akan terlihat sebagai kegagalan: `ON CONFLICT` cuma
  // melewatinya, jadi jumlah cabang yang masuk diam-diam lebih sedikit.
  // Diperiksa lebih dulu supaya yang diperbaiki datanya.
  const namaUnik = new Set(
    daftar.map((satu) => satu.nama.trim().toLocaleLowerCase("id")),
  );
  if (namaUnik.size !== daftar.length)
    throw new Error(
      "Data contoh cabang memuat nama yang kembar; hapus duplikatnya di src/lib/mock-cabang.ts (nama cabang unik tanpa membedakan huruf besar-kecil).",
    );

  const sebelum = await jumlahBaris(pool);

  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    for (const satu of daftar) {
      // Nama dibandingkan lewat ekspresi yang sama dengan indeks uniknya, jadi
      // cabang yang namanya sudah ada (termasuk beda huruf besar-kecil atau
      // spasi tepi) dilewati, bukan diduplikasi.
      const ditulis = await klien.query(
        `INSERT INTO cabang (nama, alamat, kontak, status_aktif)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (lower(btrim(nama))) DO NOTHING
         RETURNING id`,
        [
          satu.nama.trim(),
          satu.alamat.trim(),
          satu.kontak.trim(),
          satu.statusAktif,
        ],
      );
      if (ditulis.rows.length) hasil.dibuat++;
      else hasil.dilewati++;
    }
    await klien.query("COMMIT");

    const sesudah = await jumlahBaris(klien);
    console.log(
      `cabang: dibuat ${hasil.dibuat}, dilewati ${hasil.dilewati} — dari ${daftar.length} cabang contoh`,
    );
    console.log(
      `Jumlah baris: ${sebutJumlah(sebelum)} → ${sebutJumlah(sesudah)}.`,
    );
    console.log(
      hasil.dibuat > 0
        ? "\nDaftar cabang siap dipakai halaman cabang, formulir kelas, dan pantauan harian."
        : "\nTidak ada yang perlu dibuat. Seeder aman dijalankan ulang.",
    );
  } catch (error) {
    await klien.query("ROLLBACK");
    throw error;
  } finally {
    klien.release();
  }
} catch (error) {
  // Kegagalan koneksi/kueri dijelaskan lewat databaseError; galat masukan
  // (mis. salah lingkungan) memakai pesannya sendiri.
  const kode = error.cause?.code || error.code;
  console.error(
    `\nSeeder gagal: ${kode ? databaseError(error) : error.message}`,
  );
  console.error(
    "Seeder berhenti sebelum menyelesaikan semua langkah; jalankan lagi setelah penyebabnya diperbaiki.",
  );
  process.exitCode = 1;
} finally {
  await pool?.end();
}
