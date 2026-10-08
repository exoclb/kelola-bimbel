import { ApiError, withApiPermission } from "@/lib/api";
import { muridTertaut } from "@/services/jejak-baca.service";
import {
  catatanPortalAnak,
  kehadiranPortalAnak,
} from "@/services/portal.service";
import { anakPortalSchema } from "@/validators/portal";

export const runtime = "nodejs";

// `GET /api/portal/perkembangan?anak=<muridId>` — layar Progres wali untuk satu
// anak: catatan evaluasi (`data`) dan rekap kehadiran per sesi (`kehadiran`),
// plus ringkasannya (rata-rata nilai, jumlah sesi, hadir/tidak hadir) supaya
// pemanggil API tidak menghitung ulang. Kuerinya dibatasi ke anak yang tertaut ke akun
// wali itu (`wali_murid`), jadi anak orang lain dijawab 404 dan tidak ada
// catatan yang bocor. Anak yang belum punya catatan menerima daftar kosong.
export function GET(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const { anak } = anakPortalSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!(await muridTertaut(session.user.id, anak)))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const [catatan, kehadiran] = await Promise.all([
      catatanPortalAnak(anak),
      kehadiranPortalAnak(anak),
    ]);
    const hadir = kehadiran.filter((sesi) => sesi.hadir).length;
    const rataRata =
      catatan.length === 0
        ? null
        : Math.round(
            (catatan.reduce((jumlah, satu) => jumlah + satu.nilai, 0) /
              catatan.length) *
              10,
          ) / 10;

    return Response.json({
      data: catatan,
      kehadiran,
      meta: {
        muridId: anak,
        jumlah: catatan.length,
        rataRata,
        jumlahSesi: kehadiran.length,
        hadir,
        tidakHadir: kehadiran.length - hadir,
      },
    });
  });
}
