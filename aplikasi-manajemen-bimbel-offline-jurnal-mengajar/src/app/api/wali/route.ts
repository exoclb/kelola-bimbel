import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { buatAkunWali, listAkunWali } from "@/services/wali.service";
import { tambahWaliSchema } from "@/validators/wali";

export const runtime = "nodejs";

// Daftar akun wali beserta murid yang tertaut dan status akses portalnya.
// Akun wali adalah baris `user` yang berperan `orang-tua`, penautannya tabel
// `wali_murid`, dan status portalnya kolom `banned` — rinciannya di
// `src/services/wali.service.ts`. Endpoint ini membaca akun milik orang lain,
// jadi dijaga izin `pengaturan` seperti halaman pengaturan wali: guru (role
// `user`) maupun wali sendiri menerima 403.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () =>
    Response.json({ data: await listAkunWali() }),
  );
}

// Membuat akun wali baru beserta akun masuknya. Perannya selalu `orang-tua` dan
// tidak bisa dipilih dari isi permintaan; sandi awalnya ditetapkan owner dan
// tidak pernah dikembalikan ke klien (lihat `buatAkunWali`). Izinnya
// `pengaturan: write` — sama seperti endpoint pengaturan lain, karena ini
// membuat akun untuk orang lain.
//
// Email yang sudah terdaftar dijawab 409 dengan kode `EMAIL_SUDAH_DIPAKAI`,
// sama seperti `POST /api/akun`, sehingga formulir mengenali sebabnya dan
// menempelkan pesannya di isian email. Tidak ada baris akun yang dibuat saat
// permintaannya ditolak, jadi percobaan yang gagal tidak meninggalkan akun
// kembar.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const input = tambahWaliSchema.parse(await readJson(request));
    const hasil = await buatAkunWali(input);

    if (hasil.status === "email_sudah_dipakai")
      throw new ApiError(
        409,
        "EMAIL_SUDAH_DIPAKAI",
        "Email itu sudah dipakai akun lain. Pakai email lain atau tautkan akun wali yang sudah terdaftar ke murid.",
      );

    return Response.json({ data: hasil.wali }, { status: 201 });
  });
}
