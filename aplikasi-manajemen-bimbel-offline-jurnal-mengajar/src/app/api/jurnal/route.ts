import { ApiError, readJson, withApiSession } from "@/lib/api";
import { simpanJurnal } from "@/services/jurnal.service";
import { simpanJurnalSchema } from "@/validators/jurnal";

export const runtime = "nodejs";

// Menyimpan & mengirim jurnal mengajar guru. Kirim ulang untuk jadwal dan
// tanggal yang sama hanya memperbarui jurnal hari itu — tidak pernah menjadi
// dua catatan yang ikut terhitung dua kali di rekap gaji.
export function POST(request: Request) {
  return withApiSession(request, async (session) => {
    const input = simpanJurnalSchema.parse(await readJson(request));
    const hasil = await simpanJurnal(session.user.id, input);

    if (hasil.status === "jadwal_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Jadwal tidak ditemukan.");
    if (hasil.status === "jadwal_tidak_valid")
      throw new ApiError(
        422,
        "JADWAL_TIDAK_VALID",
        "Jam jadwal ini tidak wajar. Perbaiki jadwalnya dulu.",
      );
    if (hasil.status === "murid_tidak_ada")
      throw new ApiError(
        422,
        "MURID_TIDAK_ADA",
        "Ada murid yang tidak dikenal.",
        [
          ...hasil.muridIds.map((muridId) => ({
            field: "kehadiran",
            message: `Murid ${muridId} tidak dikenal.`,
          })),
        ],
      );

    return Response.json(
      { data: hasil.jurnal },
      { headers: { Location: `/api/jurnal/${hasil.jurnal.id}` } },
    );
  });
}
