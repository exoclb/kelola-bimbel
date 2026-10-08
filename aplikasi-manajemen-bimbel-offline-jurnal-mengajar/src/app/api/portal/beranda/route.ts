import { ApiError, withApiPermission } from "@/lib/api";
import { bagianPortalAnak, muatIsiPortalWali } from "@/services/portal.service";
import { muridTertaut, statusSemuaAnak } from "@/services/jejak-baca.service";
import { anakPortalSchema } from "@/validators/portal";

export const runtime = "nodejs";

// `GET /api/portal/beranda?anak=<muridId>` — identitas satu anak untuk layar
// Beranda wali, lengkap dengan ringkasannya: kelas yang sedang diikuti,
// catatan/kehadiran/tagihannya, dan status baca tiap bagian (dipakai lencana
// "Baru"). Anak yang tidak tertaut ke akun wali yang sedang masuk dijawab 404,
// jadi identitas anak wali lain tidak pernah ikut terkirim.
export function GET(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const { anak } = anakPortalSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!(await muridTertaut(session.user.id, anak)))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const isi = await muatIsiPortalWali(session.user.id);
    const terpilih = isi.anak.find((satu) => satu.muridId === anak);
    if (!terpilih)
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const [bagian, status] = await Promise.all([
      bagianPortalAnak(anak),
      statusSemuaAnak(session.user.id, [terpilih]),
    ]);

    return Response.json({
      data: {
        anak: terpilih,
        bagian,
        statusBaca: status[anak] ?? null,
      },
      meta: { muridId: anak, jumlahAnak: isi.anak.length },
    });
  });
}
