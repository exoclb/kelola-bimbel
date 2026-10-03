import { withApiSession } from "@/lib/api";
import { periodeBulan } from "@/lib/gaji";
import { rekapGajiGuru } from "@/services/gaji.service";
import { periodeGajiSchema } from "@/validators/gaji";

export const runtime = "nodejs";

// Rekap & rincian jam ngajar milik guru yang sedang masuk. Datanya selalu
// diambil dari id sesi, jadi tidak perlu izin tambahan — guru memang berhak
// melihat jam dan gajinya sendiri.
export function GET(request: Request) {
  return withApiSession(request, async (session) => {
    const { periode } = periodeGajiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({
      data: await rekapGajiGuru(periode ?? periodeBulan(new Date()), {
        id: session.user.id,
        nama: session.user.name,
        email: session.user.email,
      }),
    });
  });
}
