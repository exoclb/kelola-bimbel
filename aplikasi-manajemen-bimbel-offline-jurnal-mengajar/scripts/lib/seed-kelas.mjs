// Penulisan data awal kelas ke tabel `classes`.
//
// Dipakai skrip `npm run db:seed:kelas` dan tes basis data. Daftar kelasnya
// dibaca dari data contoh yang juga dipakai halaman kelas, jadi cabang yang
// ditunjuk selalu salah satu cabang contoh yang sudah didaftarkan
// `scripts/lib/seed-cabang.mjs`.
import { getDaftarKelas } from "../../src/lib/mock-kelas.ts";

/**
 * Tulis data awal kelas ke tabel `classes`.
 *
 * Idempoten: kelas yang pasangan nama + cabangnya sudah ada dilewati, jadi
 * menjalankan ulang tidak menambah baris — tabel `classes` tidak punya batasan
 * unik untuk pasangan itu, jadi pemeriksaannya dilakukan di sini.
 *
 * Cabang yang ditunjuk wajib sudah terdaftar (kolom `classes.cabang`
 * ber-relasi ke `cabang.nama`); kalau belum, seluruh proses dibatalkan dengan
 * pesan yang menyebut nama cabangnya.
 *
 * Jadwal tidak ikut diisi: satu jadwal wajib punya guru, sedangkan akun guru
 * dibuat terpisah lewat `npm run db:seed` dan halaman pengaturan guru.
 *
 * @param {import("pg").Pool} pool
 * @param {import("../../src/lib/mock-kelas.ts").Kelas[]} [daftar]
 * @returns {Promise<{ dibuat: number, dilewati: number, jumlah: number }>}
 */
export async function seedKelas(pool, daftar = getDaftarKelas()) {
  const hasil = { dibuat: 0, dilewati: 0, jumlah: daftar.length };
  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");

    const { rows: cabangAda } = await klien.query(
      "SELECT lower(btrim(nama)) AS kunci FROM cabang",
    );
    const terdaftar = new Set(cabangAda.map((baris) => baris.kunci));
    const kunci = (nama) => nama.trim().toLocaleLowerCase("id");
    const belumAda = [
      ...new Set(
        daftar
          .map((kelas) => kelas.cabang)
          .filter((nama) => !terdaftar.has(kunci(nama))),
      ),
    ];
    if (belumAda.length > 0)
      throw new Error(
        `Cabang ini belum terdaftar, jadi kelasnya tidak bisa ditulis: ${belumAda.join(", ")}. Jalankan npm run db:seed:cabang lebih dulu.`,
      );

    for (const kelas of daftar) {
      const sudahAda = await klien.query(
        "SELECT 1 FROM classes WHERE nama_kelas = $1 AND cabang = $2 LIMIT 1",
        [kelas.namaKelas, kelas.cabang],
      );
      if (sudahAda.rowCount > 0) {
        hasil.dilewati++;
        continue;
      }

      await klien.query(
        "INSERT INTO classes (nama_kelas, cabang) VALUES ($1, $2)",
        [kelas.namaKelas, kelas.cabang],
      );
      hasil.dibuat++;
    }

    await klien.query("COMMIT");
  } catch (error) {
    await klien.query("ROLLBACK");
    throw error;
  } finally {
    klien.release();
  }

  return hasil;
}
