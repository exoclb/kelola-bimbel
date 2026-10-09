// Mengisi seluruh data contoh modul cabang sekaligus: tabel `cabang` lebih dulu
// (`scripts/lib/seed-cabang.mjs`), lalu kelas contoh yang menunjuk cabang itu
// (`scripts/lib/seed-kelas.mjs`) — urutannya penting karena kelas hanya boleh
// menunjuk cabang yang sudah terdaftar.
//
// Seperti seeder lain, ini khusus lingkungan pengembangan: dijalankan hanya
// saat NODE_ENV bukan `production` (atau dengan `--paksa` bila memang
// disengaja). Semua langkahnya idempoten, jadi aman dijalankan berkali-kali.
//
// Contoh:
//   npm run db:seed:contoh
import { Pool } from "pg";
import { loadEnvironment } from "./lib.mjs";
import { seedCabang } from "./lib/seed-cabang.mjs";
import { seedKelas } from "./lib/seed-kelas.mjs";
import { databaseError, databaseUrl } from "./postgres.mjs";

const paksa = process.argv.includes("--paksa");

/** Jumlah baris `cabang` dan `classes` sekaligus. */
async function jumlahBaris(klien) {
  const { rows } = await klien.query(
    `SELECT (SELECT count(*)::int FROM cabang) AS cabang,
            (SELECT count(*)::int FROM classes) AS kelas`,
  );
  return rows[0];
}

function sebutJumlah(jumlah) {
  return `${jumlah.cabang} cabang, ${jumlah.kelas} kelas`;
}

console.log("\nSeeder data contoh cabang & kelas\n");

let pool;
try {
  if (process.env.NODE_ENV === "production" && !paksa)
    throw new Error(
      "Seeder data contoh hanya untuk lingkungan pengembangan. Data sungguhan diisi lewat halaman cabang dan kelas; tambahkan --paksa kalau memang ingin mengisi data contoh di lingkungan ini.",
    );

  await loadEnvironment();
  pool = new Pool({
    connectionString: databaseUrl(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", () => {});

  const sebelum = await jumlahBaris(pool);
  const cabang = await seedCabang(pool);
  const kelas = await seedKelas(pool);
  const sesudah = await jumlahBaris(pool);

  console.log(
    `cabang: dibuat ${cabang.dibuat}, dilewati ${cabang.dilewati} — dari ${cabang.jumlah} cabang contoh`,
  );
  console.log(
    `kelas: dibuat ${kelas.dibuat}, dilewati ${kelas.dilewati} — dari ${kelas.jumlah} kelas contoh`,
  );
  console.log(
    `Jumlah baris: ${sebutJumlah(sebelum)} → ${sebutJumlah(sesudah)}.`,
  );
  console.log(
    cabang.dibuat > 0 || kelas.dibuat > 0
      ? "\nData contoh siap dipakai halaman cabang, halaman kelas, dan pantauan harian."
      : "\nTidak ada yang perlu dibuat. Seeder aman dijalankan ulang.",
  );
} catch (error) {
  // Kegagalan koneksi/kueri dijelaskan lewat databaseError; galat masukan
  // (mis. salah lingkungan atau data contoh kembar) memakai pesannya sendiri.
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
