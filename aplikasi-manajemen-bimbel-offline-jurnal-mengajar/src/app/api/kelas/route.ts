import { ApiError, readJson, withApiSession } from "@/lib/api";
import { adaGuru, createKelas, listKelas } from "@/services/kelas.service";
import { createKelasSchema, listKelasSchema } from "@/validators/kelas";

export const runtime = "nodejs";

// Daftar kelas beserta jadwalnya. Bisa disaring dengan `?cari=` (nama kelas,
// cabang, atau nama guru) dan dibatasi dengan `?limit=&offset=`.
export function GET(request: Request) {
  return withApiSession(request, async () => {
    const filter = listKelasSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listKelas(filter));
  });
}

// Membuat kelas baru, boleh sekaligus dengan jadwalnya. Guru maupun owner
// boleh mengatur data kelas bimbel.
export function POST(request: Request) {
  return withApiSession(request, async () => {
    const input = createKelasSchema.parse(await readJson(request));
    // Tanpa pemeriksaan ini, guru yang tidak ada berhenti sebagai galat
    // foreign key dan klien hanya menerima 500 tanpa keterangan.
    if (input.guruId && !(await adaGuru(input.guruId)))
      throw new ApiError(
        422,
        "GURU_TIDAK_ADA",
        "Guru pengampu tidak ditemukan.",
      );

    const kelas = await createKelas(input);
    return Response.json(
      { data: kelas },
      { status: 201, headers: { Location: `/api/kelas/${kelas?.id ?? ""}` } },
    );
  });
}
