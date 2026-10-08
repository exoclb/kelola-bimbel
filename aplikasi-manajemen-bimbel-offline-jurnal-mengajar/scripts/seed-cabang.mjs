// Mengisi tabel `cabang` dari data awal di `src/lib/mock-cabang.ts`: daftar
// cabang contoh yang namanya sudah dipakai kolom `cabang` pada data kelas.
// Seeder ini khusus lingkungan pengembangan — produksi memakai data cabang
// sungguhan lewat halaman pengaturan cabang — jadi dijalankan hanya saat
// NODE_ENV bukan `production` (atau dengan `--paksa` bila memang disengaja).
//
// Penulisannya ada di `scripts/lib/seed-cabang.mjs` supaya skrip ini hanya
// mengurus jalur jalan, laporan, dan penjagaan lingkungan.
//
// Contoh:
//   npm run db:seed:cabang
import { Pool } from "pg";
import { loadEnvironment } from "./lib.mjs";
import { seedCabang } from "./lib/seed-cabang.mjs";
import { databaseError, databaseUrl } from "./postgres.mjs";

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

  const sebelum = await jumlahBaris(pool);
  const hasil = await seedCabang(pool);
  const sesudah = await jumlahBaris(pool);

  console.log(
    `cabang: dibuat ${hasil.dibuat}, dilewati ${hasil.dilewati} — dari ${hasil.jumlah} cabang contoh`,
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
  // Kegagalan koneksi/kueri dijelaskan lewat databaseError; galat masukan
  // (mis. salah lingkungan atau data kembar) memakai pesannya sendiri.
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
