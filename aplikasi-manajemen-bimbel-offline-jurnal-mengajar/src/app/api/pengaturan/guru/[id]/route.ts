import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { ubahStatusGuru } from "@/services/pengaturan.service";
import { guruIdSchema, ubahStatusGuruSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Mengaktifkan atau menonaktifkan akun guru. Menonaktifkan berarti akun itu
// tidak bisa masuk lagi dan sesinya yang masih tersimpan langsung tidak
// berlaku; jurnal dan catatannya tetap ada.
export function PATCH(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const id = guruIdSchema.parse((await context.params).id);
    const { statusAktif } = ubahStatusGuruSchema.parse(await readJson(request));

    const hasil = await ubahStatusGuru(id, statusAktif);
    if (hasil.status === "tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Akun tidak ditemukan.");
    if (hasil.status === "bukan_guru")
      throw new ApiError(
        422,
        "AKUN_OWNER",
        "Akun owner tidak bisa dinonaktifkan di sini.",
      );

    return Response.json({ data: hasil.akun });
  });
}
