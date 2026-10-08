import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { getAkunWali, setAksesPortal } from "@/services/wali.service";
import { ubahAksesWaliSchema, waliIdSchema } from "@/validators/wali";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Satu akun wali beserta murid yang tertaut dan status akses portalnya.
// Id yang bukan akun wali (atau tidak ada) dijawab 404, sama seperti id acak
// lain yang tidak dikenal.
export function GET(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () => {
    const id = waliIdSchema.parse((await context.params).id);
    const wali = await getAkunWali(id);
    if (!wali)
      throw new ApiError(404, "NOT_FOUND", "Akun wali tidak ditemukan.");
    return Response.json({ data: wali });
  });
}

// Menyalakan (`true`) atau mematikan (`false`) akses portal satu akun wali.
// Aman diulang: mengirim nilai yang sudah berlaku tetap 200 dan tidak mengubah
// apa pun — `meta.berubah` membedakannya supaya tampilan bisa memilih pesan.
export function PATCH(request: Request, context: Context) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const id = waliIdSchema.parse((await context.params).id);
    const input = ubahAksesWaliSchema.parse(await readJson(request));
    const hasil = await setAksesPortal(id, input.aksesPortal);

    if (hasil.status === "wali_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Akun wali tidak ditemukan.");

    return Response.json({
      data: hasil.wali,
      meta: { berubah: hasil.berubah },
    });
  });
}
