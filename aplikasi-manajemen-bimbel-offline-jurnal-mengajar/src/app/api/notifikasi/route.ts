import { readJson, withApiSession } from "@/lib/api";
import {
  listNotifikasi,
  tandaiNotifikasiDibaca,
} from "@/services/notifikasi.service";
import {
  listNotifikasiSchema,
  tandaiBacaSchema,
} from "@/validators/notifikasi";

export const runtime = "nodejs";

// Daftar notifikasi milik akun yang sedang masuk. Query `?belumDibaca=true`
// menyaring yang belum dibaca saja.
export function GET(request: Request) {
  return withApiSession(request, async (session) => {
    const filter = listNotifikasiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listNotifikasi(session.user.id, filter));
  });
}

// Tandai baca: `{ "ids": [...] }` untuk notifikasi tertentu, atau
// `{ "semua": true }` untuk semua yang belum dibaca.
export function PATCH(request: Request) {
  return withApiSession(request, async (session) => {
    const input = tandaiBacaSchema.parse(await readJson(request));
    return Response.json(await tandaiNotifikasiDibaca(session.user.id, input));
  });
}
