import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { listCabang, tambahCabang } from "@/services/cabang.service";
import { buatCabangSchema } from "@/validators/cabang";

export const runtime = "nodejs";

// Daftar cabang bimbel, diurutkan nama. Cabang bagian dari pengaturan bimbel,
// jadi hanya owner dan admin. Sementara ini sumbernya masih data tiruan
// (`src/lib/mock-cabang.ts`), belum tabel database.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () =>
    Response.json({ data: listCabang() }),
  );
}

// Menambah cabang baru. Nama yang sudah dipakai dijawab 409, sama seperti
// penambahan lewat halaman cabang.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const input = buatCabangSchema.parse(await readJson(request));
    const hasil = tambahCabang(input);

    if (!hasil.ok) throw new ApiError(409, "NAMA_SUDAH_DIPAKAI", hasil.pesan);

    return Response.json({ data: hasil.cabang }, { status: 201 });
  });
}
