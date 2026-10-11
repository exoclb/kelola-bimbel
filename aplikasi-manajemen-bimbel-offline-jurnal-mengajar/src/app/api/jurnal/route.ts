import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { listJurnalGuru, simpanJurnal } from "@/services/jurnal.service";
import { listJurnalSchema, simpanJurnalSchema } from "@/validators/jurnal";

export const runtime = "nodejs";

// Riwayat jurnal guru yang sedang masuk, terbaru lebih dulu. Saringan kelas
// dan rentang tanggal dikerjakan di database, bukan di tampilan.
export function GET(request: Request) {
  return withApiPermission(request, { staf: ["read"] }, async (session) => {
    const filter = listJurnalSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listJurnalGuru(session.user.id, filter));
  });
}

// Menyimpan & mengirim jurnal mengajar guru. Kirim ulang untuk jadwal dan
// tanggal yang sama hanya memperbarui jurnal hari itu — tidak pernah menjadi
// dua catatan yang ikut terhitung dua kali di rekap gaji.
export function POST(request: Request) {
  return withApiPermission(request, { staf: ["write"] }, async (session) => {
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
        hasil.muridIds.map((muridId) => ({
          field: "kehadiran",
          message: `Murid ${muridId} tidak dikenal.`,
        })),
      );
    if (hasil.status === "murid_tidak_di_kelas")
      throw new ApiError(
        422,
        "MURID_TIDAK_DI_KELAS",
        "Ada murid yang tidak terdaftar di kelas ini.",
        hasil.muridIds.map((muridId) => ({
          field: "kehadiran",
          message: `Murid ${muridId} tidak terdaftar di kelas ini.`,
        })),
      );

    return Response.json(
      { data: hasil.jurnal },
      { headers: { Location: `/api/jurnal/${hasil.jurnal.id}` } },
    );
  });
}
