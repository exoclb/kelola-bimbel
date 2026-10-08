import { ApiError, withApiSession } from "@/lib/api";
import { peranDariRole } from "@/lib/peran";
import { listRiwayatKehadiranGuru } from "@/services/presensi-guru.service";
import { rekapPresensiGuruSchema } from "@/validators/presensi-guru";

export const runtime = "nodejs";

// Rekap kehadiran guru: guru membaca miliknya sendiri, owner/admin boleh
// membaca semua (`?guruId=` untuk satu guru). Rentang tanggal opsional.
export function GET(request: Request) {
  return withApiSession(request, async (session) => {
    const query = rekapPresensiGuruSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const semua = peranDariRole(session.user.role) === "owner";

    if (!semua && query.guruId && query.guruId !== session.user.id)
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Hanya pemilik bimbel yang bisa melihat presensi guru lain.",
      );

    return Response.json(
      await listRiwayatKehadiranGuru({
        ...query,
        guruId: semua ? query.guruId : session.user.id,
      }),
    );
  });
}
