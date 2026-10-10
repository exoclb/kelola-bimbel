import { ApiError, readJson, withApiSession } from "@/lib/api";
import { ubahDataAkun } from "@/services/pengaturan.service";
import { ubahDataAkunSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Mengubah data akun sendiri. Endpoint ini sengaja tidak meminta izin khusus:
// yang boleh disentuh hanya akun yang sedang masuk, dan id-nya diambil dari
// sesi — bukan dari badan permintaan — jadi akun lain tidak bisa ikut berubah
// lewat jalur ini. Namanya satu-satunya isian; email akun adalah identitas
// masuk yang perubahannya menuntut verifikasi alamat baru.
export function PATCH(request: Request) {
  return withApiSession(request, async (session) => {
    const { nama } = ubahDataAkunSchema.parse(await readJson(request));

    const hasil = await ubahDataAkun(session.user.id, { nama });
    if (hasil.status === "tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");

    return Response.json({ data: hasil.akun });
  });
}
