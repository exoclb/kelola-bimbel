import { ApiError, withApiPermission } from "@/lib/api";
import { muridTertaut } from "@/services/jejak-baca.service";
import { catatanPortalAnak } from "@/services/portal.service";
import { anakPortalSchema } from "@/validators/portal";

export const runtime = "nodejs";

// `GET /api/portal/perkembangan?anak=<muridId>` — catatan evaluasi satu anak
// untuk wali yang sedang masuk. Kuerinya dibatasi ke anak yang tertaut ke akun
// wali itu (`wali_murid`), jadi anak orang lain dijawab 404 dan tidak ada
// catatan yang bocor. Anak yang belum punya catatan menerima daftar kosong.
export function GET(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const { anak } = anakPortalSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!(await muridTertaut(session.user.id, anak)))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const data = await catatanPortalAnak(anak);
    return Response.json({
      data,
      meta: { muridId: anak, jumlah: data.length },
    });
  });
}
