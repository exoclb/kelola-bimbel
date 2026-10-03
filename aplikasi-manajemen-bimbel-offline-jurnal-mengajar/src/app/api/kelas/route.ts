import { readJson, withApiSession } from "@/lib/api";
import { createKelas, listKelas } from "@/services/kelas.service";
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
    const kelas = await createKelas(input);
    return Response.json(
      { data: kelas },
      { status: 201, headers: { Location: `/api/kelas/${kelas?.id ?? ""}` } },
    );
  });
}
