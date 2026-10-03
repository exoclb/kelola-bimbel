import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { listAkunBimbel, tambahGuru } from "@/services/pengaturan.service";
import { listGuruSchema, tambahGuruSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Daftar akun bimbel (guru dan owner) beserta status aktifnya. Dipakai halaman
// Kelola Guru; boleh dibaca yang punya izin pengaturan.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () => {
    const filter = listGuruSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listAkunBimbel(filter));
  });
}

// Menambah akun guru baru. Perannya tidak bisa dipilih: akun baru selalu
// berperan guru, dan owner tetap tidak bisa dinonaktifkan lewat endpoint ini.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const input = tambahGuruSchema.parse(await readJson(request));
    const hasil = await tambahGuru(input);

    if (hasil.status === "email_sudah_dipakai")
      throw new ApiError(
        409,
        "EMAIL_SUDAH_DIPAKAI",
        "Email itu sudah dipakai akun lain. Pakai email yang berbeda.",
      );

    return Response.json({ data: hasil.akun }, { status: 201 });
  });
}
