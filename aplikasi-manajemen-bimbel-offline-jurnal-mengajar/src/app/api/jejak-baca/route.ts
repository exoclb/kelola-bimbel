import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  muridTertaut,
  statusAnak,
  tandaiTerbaca,
} from "@/services/jejak-baca.service";
import {
  statusJejakQuerySchema,
  tandaiJejakSchema,
} from "@/validators/jejak-baca";

export const runtime = "nodejs";

// Status jejak baca Portal Wali untuk satu anak: bagian mana yang masih
// bertanda "baru". Statusnya milik tiap akun wali (diambil dari sesi), dan anak
// yang bukan tertaut ke akun itu dijawab 404 — bukan diam-diam dibaca.

// `GET /api/jejak-baca?anak=<muridId>`.
export function GET(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const { anak } = statusJejakQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!muridTertaut(anak))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    return Response.json({
      data: { anak, bagian: statusAnak(session.user.id, anak) },
    });
  });
}

// `POST /api/jejak-baca` dengan badan `{ anak, bagian }`, di mana `bagian` boleh
// satu nama atau daftar nama. Wali yang menandai diambil dari sesi, jadi klien
// tidak bisa menandai atas nama akun lain. Menandai ulang idempoten.
export function POST(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const input = tandaiJejakSchema.parse(await readJson(request));
    if (!muridTertaut(input.anak))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const bagian = Array.isArray(input.bagian)
      ? [...new Set(input.bagian)]
      : [input.bagian];

    return Response.json({
      data: {
        anak: input.anak,
        bagian: tandaiTerbaca(session.user.id, input.anak, bagian),
      },
    });
  });
}
