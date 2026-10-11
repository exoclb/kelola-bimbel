import { readJson, withApiPermission } from "@/lib/api";
import { createMurid, listMurid } from "@/services/murid.service";
import { createMuridSchema, listMuridSchema } from "@/validators/murid";

export const runtime = "nodejs";

// Daftar murid bimbel. Bisa disaring dengan `?cari=` (nama murid atau orang
// tuanya) dan dibatasi dengan `?limit=&offset=`.
export function GET(request: Request) {
  return withApiPermission(request, { staf: ["read"] }, async () => {
    const filter = listMuridSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json(await listMurid(filter));
  });
}

// Menambah murid baru. Guru maupun owner boleh menambahkan data murid.
export function POST(request: Request) {
  return withApiPermission(request, { staf: ["write"] }, async () => {
    const input = createMuridSchema.parse(await readJson(request));
    const murid = await createMurid(input);
    return Response.json(
      { data: murid },
      { status: 201, headers: { Location: `/api/murid/${murid.id}` } },
    );
  });
}
