// Penulisan data awal cabang ke tabel `cabang`.
//
// Dipisahkan dari skrip `npm run db:seed:cabang` supaya hanya ada satu tempat
// yang tahu cara menulisnya, dan supaya tes basis data bisa membuktikan
// seeder-nya aman dijalankan berulang.
//
// `src/lib/mock-cabang.ts` dibaca langsung dari sini: modul itu tidak
// mengimpor alias `@/` maupun paket lain, jadi Node bisa memuatnya sendiri
// (anotasi tipenya dihapus saat dimuat).
import { getDaftarCabang } from "../../src/lib/mock-cabang.ts";

/**
 * Tulis data awal cabang ke tabel `cabang` dalam satu transaksi.
 *
 * Idempoten: tiap baris memakai `INSERT ... ON CONFLICT DO NOTHING` pada nama
 * yang tak peka huruf besar-kecil (indeks `cabang_nama_unik_idx`), jadi nama
 * yang sudah ada dilewati — menjalankan ulang tidak menambah baris baru.
 *
 * Sengaja `DO NOTHING`, bukan `DO UPDATE`: cabang yang sudah ada tidak pernah
 * ditimpa, sehingga alamat, kontak, atau status yang sudah diubah pemilik lewat
 * halaman cabang tetap utuh walau seeder dijalankan lagi (dan data contoh di
 * `src/lib/mock-cabang.ts` berubah).
 *
 * Nama kembar di dalam daftarnya sendiri ditolak lebih dulu: `ON CONFLICT`
 * hanya akan melewatinya, sehingga jumlah cabang yang masuk diam-diam lebih
 * sedikit daripada yang ada di daftar.
 *
 * @param {import("pg").Pool} pool
 * @param {import("../../src/lib/mock-cabang.ts").DataCabang[]} [daftar]
 * @returns {Promise<{ dibuat: number, dilewati: number, jumlah: number }>}
 */
export async function seedCabang(pool, daftar = getDaftarCabang()) {
  const namaUnik = new Set(
    daftar.map((satu) => satu.nama.trim().toLocaleLowerCase("id")),
  );
  if (namaUnik.size !== daftar.length)
    throw new Error(
      "Data contoh cabang memuat nama yang kembar; hapus duplikatnya di src/lib/mock-cabang.ts (nama cabang unik tanpa membedakan huruf besar-kecil).",
    );

  const hasil = { dibuat: 0, dilewati: 0, jumlah: daftar.length };
  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    for (const satu of daftar) {
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
  } catch (error) {
    await klien.query("ROLLBACK");
    throw error;
  } finally {
    klien.release();
  }

  return hasil;
}
