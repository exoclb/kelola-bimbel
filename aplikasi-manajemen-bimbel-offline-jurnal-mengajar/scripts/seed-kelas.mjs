// Mengisi tabel `classes` dari data awal di `src/lib/mock-kelas.ts`: daftar
// kelas contoh yang cabangnya sudah didaftarkan `npm run db:seed:cabang`
// (kolom `classes.cabang` ber-relasi ke `cabang.nama`). Skrip ini khusus
// lingkungan pengembangan — produksi memakai kelas sungguhan lewat halaman
// kelas — jadi dijalankan hanya saat NODE_ENV bukan `production` (atau dengan
// `--paksa` bila memang disengaja).
//
// Penulisannya ada di `scripts/lib/seed-kelas.mjs` supaya skrip ini hanya
// mengurus jalur jalan, laporan, dan penjagaan lingkungan.
//
// Contoh:
//   npm run db:seed:cabang && npm run db:seed:kelas
import { Pool } from "pg";
import { loadEnvironment } from "./lib.mjs";
import { seedKelas } from "./lib/seed-kelas.mjs";
import { databaseError, databaseUrl } from "./postgres.mjs";

const paksa = process.argv.includes("--paksa");

/** Jumlah baris `classes` beserta berapa yang bercabang. */
async function jumlahBaris(klien) {
  const { rows } = await klien.query(
    `SELECT count(*)::int AS kelas, count(*) filter (where cabang <> '')::int AS bercabang
       FROM classes`,
  );
  return rows[0];
}

function sebutJumlah(jumlah) {
  return `${jumlah.kelas} baris (${jumlah.bercabang} bercabang)`;
}

console.log("\nSeeder data awal kelas\n");

let pool;
try {
  if (process.env.NODE_ENV === "production" && !paksa)
    throw new Error(
      "Seeder data awal kelas hanya untuk lingkungan pengembangan. Kelas sungguhan dibuat lewat halaman kelas; tambahkan --paksa kalau memang ingin mengisi data contoh di lingkungan ini.",
    );

  await loadEnvironment();
  pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", () => {});

  const sebelum = await jumlahBaris(pool);
  const hasil = await seedKelas(pool);
  const sesudah = await jumlahBaris(pool);

  console.log(
    `kelas: dibuat ${hasil.dibuat}, dilewati ${hasil.dilewati} — dari ${hasil.jumlah} kelas contoh`,
  );
  console.log(
    `Jumlah baris: ${sebutJumlah(sebelum)} → ${sebutJumlah(sesudah)}.`,
  );
  console.log(
    hasil.dibuat > 0
      ? "\nDaftar kelas contoh siap; jumlah kelas per cabang ikut terisi di halaman cabang."
      : "\nTidak ada yang perlu dibuat. Seeder aman dijalankan ulang.",
  );
} catch (error) {
  // Kegagalan koneksi/kueri dijelaskan lewat databaseError; galat masukan
  // (mis. salah lingkungan atau cabang belum terdaftar) memakai pesannya sendiri.
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
