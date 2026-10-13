import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  adaPemulihanBerjalan,
  ambilBerkasBackupUjiById,
  catatHasilUjiPemulihan,
  jalankanUjiPemulihan,
} from "@/services/backup.service";
import { jalankanUjiPemulihanSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Menjalankan satu uji pemulihan: berkas backup yang dipilih dipulihkan ke
// database percobaan, isinya diperiksa, lalu hasilnya langsung dijawab supaya
// halaman bisa melaporkannya.
//
// Pengamanannya ada tiga lapis, dan ketiganya menahan sebelum perintah apa pun
// dijalankan:
//
// 1. Izin tulis `pengaturan` (owner & admin). Memulihkan berarti menuangkan
//    seluruh isi salinan ke sebuah database, bukan sekadar membacanya.
// 2. Berkasnya dipilih lewat id catatan backup, bukan lewat path kiriman
//    pemanggil — jadi hanya berkas yang pernah dicatat `sukses` dan punya lokasi
//    yang bisa dipulihkan. Id yang tidak memenuhi itu dijawab 404.
// 3. Tujuannya database percobaan: `RESTORE_DATABASE_URL` dibandingkan dulu
//    dengan database yang sedang dipakai aplikasi, dan pemulihannya dibatalkan
//    kalau namanya sama atau tidak terbaca (lihat `pulihkanBerkasBackup`).
//
// Hasilnya dijawab 200 walau pemulihannya gagal: yang dilaporkan di sini adalah
// hasil ujinya, dan alasannya ada di `data.berhasil`/`data.pesan`. Uji yang
// gagal tetap berharga — justru itu yang membuktikan salinannya belum layak
// diandalkan. Perintah pemulihannya sendiri sengaja tidak ikut dijawab karena
// memuat connection string database percobaannya.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const { backupId } = jalankanUjiPemulihanSchema.parse(
      await readJson(request),
    );

    const berkas = await ambilBerkasBackupUjiById(backupId);
    if (!berkas)
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Berkas backup itu tidak ada, tidak berstatus sukses, atau belum punya lokasi berkas — jadi tidak ada salinan utuh yang bisa diuji.",
      );

    const hasil = await jalankanUjiPemulihan({ lokasi: berkas.lokasi });

    // Hasilnya dicatat ke baris backup yang diuji supaya jadi bukti yang bisa
    // ditelusuri dari riwayat backup. Baris yang keburu hilang tidak menghalangi
    // jawabannya: ujinya toh sudah jalan, dan yang perlu diketahui pemanggil
    // adalah hasilnya — `tercatat: null` berarti catatannya tidak tersimpan.
    const tercatat = await catatHasilUjiPemulihan(berkas.id, hasil);

    return Response.json({
      data: {
        ...hasil,
        berkas,
        tercatat: tercatat
          ? {
              id: tercatat.id,
              catatanUjiPemulihan: tercatat.catatanUjiPemulihan,
            }
          : null,
      },
    });
  });
}

// Keadaan uji yang sedang berjalan, dipakai halaman untuk menampilkan tombolnya
// dalam keadaan menunggu. Hanya satu uji yang boleh jalan sekaligus, karena
// semuanya menuangkan isinya ke database percobaan yang sama.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () =>
    Response.json({ data: { berjalan: adaPemulihanBerjalan() } }),
  );
}
