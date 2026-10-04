import { ApiError, readJson, withApiSession } from "@/lib/api";
import {
  adaKelas,
  listMuridKelas,
  tempatkanMurid,
} from "@/services/kelas.service";
import { tanggalISO } from "@/lib/tanggal";
import { kelasIdSchema, tempatkanMuridSchema } from "@/validators/kelas";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

// Daftar murid yang sedang belajar di satu kelas.
export function GET(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = kelasIdSchema.parse((await context.params).id);
    if (!(await adaKelas(id)))
      throw new ApiError(404, "NOT_FOUND", "Kelas tidak ditemukan.");
    return Response.json({ data: await listMuridKelas(id) });
  });
}

// Menempatkan murid ke kelas ini. Satu murid hanya boleh punya satu kelas
// aktif di kelas yang sama, jadi penempatan kedua di kelas itu dijawab 409.
export function POST(request: Request, context: Context) {
  return withApiSession(request, async () => {
    const id = kelasIdSchema.parse((await context.params).id);
    const input = tempatkanMuridSchema.parse(await readJson(request));
    const hasil = await tempatkanMurid(
      id,
      input.muridId,
      input.tanggalMulai ?? tanggalISO(new Date()),
    );

    if (hasil.status === "kelas_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Kelas tidak ditemukan.");
    if (hasil.status === "murid_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Murid tidak ditemukan.");
    // Sejak aturan multi-kelas, murid boleh aktif di beberapa kelas; yang
    // ditolak hanya penempatan kedua di kelas yang sama.
    if (hasil.status === "sudah_terdaftar")
      throw new ApiError(
        409,
        "SUDAH_TERDAFTAR",
        "Murid ini sudah terdaftar di kelas ini.",
      );

    return Response.json({ data: await listMuridKelas(id) }, { status: 201 });
  });
}
