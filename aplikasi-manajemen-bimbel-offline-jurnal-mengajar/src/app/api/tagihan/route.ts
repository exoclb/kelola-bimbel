import { ApiError, readJson, withApiPermission } from "@/lib/api";
import {
  createTagihan,
  daftarMuridSudahDitagih,
  listTagihan,
} from "@/services/tagihan.service";
import { createTagihanSchema, listTagihanSchema } from "@/validators/tagihan";

export const runtime = "nodejs";

// Daftar tagihan satu periode, diurutkan nama murid. `muridSudahDitagih`
// dipakai tampilan untuk menandai murid yang tagihannya sudah dibuat.
export function GET(request: Request) {
  return withApiPermission(request, { tagihan: ["read-any"] }, async () => {
    const query = listTagihanSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const data = await listTagihan(query);
    const muridSudahDitagih = await daftarMuridSudahDitagih(query);
    return Response.json({
      data,
      meta: {
        periode: query.periode,
        jumlah: data.length,
        muridSudahDitagih,
      },
    });
  });
}

// Membuat tagihan sekaligus untuk banyak murid. Murid yang sudah punya
// tagihan periode itu dilewati, bukan dibuat dobel; murid yang id-nya sudah
// tidak ada ditolak sebagai 404 supaya batch-nya tidak disimpan separuh.
export function POST(request: Request) {
  return withApiPermission(request, { tagihan: ["write-any"] }, async () => {
    const input = createTagihanSchema.parse(await readJson(request));
    const hasil = await createTagihan(input);
    if (hasil.status === "murid_tidak_ada")
      throw new ApiError(
        404,
        "NOT_FOUND",
        "Sebagian murid tidak ditemukan. Muat ulang halaman lalu pilih lagi.",
      );

    return Response.json({ data: hasil }, { status: 201 });
  });
}
