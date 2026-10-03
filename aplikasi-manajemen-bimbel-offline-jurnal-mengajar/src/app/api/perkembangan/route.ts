import { ApiError, readJson, withApiSession } from "@/lib/api";
import {
  createCatatanPerkembangan,
  listCatatanPerkembangan,
} from "@/services/perkembangan.service";
import {
  createPerkembanganSchema,
  listPerkembanganSchema,
} from "@/validators/perkembangan";

export const runtime = "nodejs";

// Riwayat catatan perkembangan anak. Bisa disaring per anak (`muridId`),
// per rentang tanggal (`dari`/`sampai`), atau dicari isinya (`cari`).
export function GET(request: Request) {
  return withApiSession(request, async () => {
    const filter = listPerkembanganSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listCatatanPerkembangan(filter));
  });
}

// Mencatat perkembangan seorang anak. Guru penulisnya diambil dari sesi, jadi
// klien tidak bisa mengaku-aku sebagai akun lain.
export function POST(request: Request) {
  return withApiSession(request, async (session) => {
    const input = createPerkembanganSchema.parse(await readJson(request));
    const hasil = await createCatatanPerkembangan(session.user.id, input);

    if (hasil.status === "murid_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Murid tidak ditemukan.");

    return Response.json(
      { data: hasil.catatan },
      {
        status: 201,
        headers: { Location: `/api/perkembangan/${hasil.catatan.id}` },
      },
    );
  });
}
