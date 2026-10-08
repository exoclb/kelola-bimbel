import { ApiError, withApiPermission } from "@/lib/api";
import { muridTertaut } from "@/services/jejak-baca.service";
import { listTagihanWali } from "@/services/tagihan.service";
import { anakPortalSchema } from "@/validators/portal";

export const runtime = "nodejs";

// `GET /api/portal/tagihan?anak=<muridId>` — tagihan SPP satu anak untuk akun
// wali yang sedang masuk.
//
// Hanya baca: tagihan milik akun wali diambil dari sesi, kuerinya memfilter
// penautan `wali_murid` di SQL, dan anak yang bukan tertaut ke akun itu dijawab
// 404 seperti endpoint portal lain — bukan diam-diam dibaca atau dikosongkan
// tanpa penjelasan.
export function GET(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const { anak } = anakPortalSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!(await muridTertaut(session.user.id, anak)))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const data = await listTagihanWali(session.user.id, anak);
    return Response.json({ data, meta: { anak, jumlah: data.length } });
  });
}
