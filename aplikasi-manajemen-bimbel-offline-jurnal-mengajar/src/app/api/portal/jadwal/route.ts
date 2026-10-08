import { ApiError, withApiPermission } from "@/lib/api";
import { muridTertaut } from "@/services/jejak-baca.service";
import { listJadwalAnak } from "@/services/portal.service";
import { namaHari, urutkanJadwal } from "@/lib/tanggal";
import { anakPortalSchema } from "@/validators/portal";

export const runtime = "nodejs";

// `GET /api/portal/jadwal?anak=<muridId>` — jadwal belajar satu anak untuk
// layar Jadwal wali: semua sesi pekan ini dari kelas yang sedang diikuti,
// terurut hari lalu jam mulai, lengkap dengan kelas, cabang, guru, dan tanggal
// jadwal itu dibuat (dipakai penanda "Baru").
//
// Status "Berlangsung"/"Berikutnya" **tidak** dihitung di sini: penentuannya
// memakai jam perangkat wali (lihat `useMenitPerangkat`), supaya zona waktu
// server tidak menggeser hari. `meta.hariIni` hanya nilai awal dari server.
export function GET(request: Request) {
  return withApiPermission(request, { portal: ["read"] }, async (session) => {
    const { anak } = anakPortalSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!(await muridTertaut(session.user.id, anak)))
      throw new ApiError(404, "NOT_FOUND", "Anak tidak tertaut ke akun ini.");

    const data = (await listJadwalAnak([anak])).sort(urutkanJadwal);
    return Response.json({
      data,
      meta: {
        muridId: anak,
        jumlah: data.length,
        hariIni: namaHari(new Date()),
      },
    });
  });
}
