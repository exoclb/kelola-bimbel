import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { simpanLogoBimbel } from "@/services/pengaturan.service";
import { unggahLogoSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Mengunggah (atau mengganti) logonya saja, tanpa menyentuh kolom lain.
// `PUT /api/pengaturan/profil` mengganti profil secara utuh dan menuntut `nama`,
// jadi mengganti logo lewat jalur itu berarti membaca profilnya dulu lalu
// mengirim ulang semuanya — dan isian yang lupa disertakan akan terhapus.
// Endpoint ini hanya menyentuh kolom logonya, jadi tipe pemanggilnya cukup tahu
// hal yang ia ubah. Logonya tetap berupa data URL yang isinya diperiksa
// (`src/lib/logo.ts`), sama seperti lewat `PUT`: yang tersimpan selalu gambar
// sungguhan, bukan teks yang mengaku gambar.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const { logo } = unggahLogoSchema.parse(await readJson(request));
    const hasil = await simpanLogoBimbel(logo);
    if (!hasil.ok) throw new ApiError(409, "PROFIL_BELUM_DIISI", hasil.pesan);
    return Response.json({ data: hasil.profil });
  });
}

// Menghapus logonya saja dan mengembalikan profilnya (nama, kontak, dan sisa
// kolom lain tetap). Aman diulang: profil yang memang sudah tanpa logo — atau
// yang belum pernah diisi — tetap dijawab 200 dengan bentuk kosong, bukan 404.
export function DELETE(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const hasil = await simpanLogoBimbel(null);
    if (!hasil.ok) throw new ApiError(409, "PROFIL_BELUM_DIISI", hasil.pesan);
    return Response.json({ data: hasil.profil });
  });
}
