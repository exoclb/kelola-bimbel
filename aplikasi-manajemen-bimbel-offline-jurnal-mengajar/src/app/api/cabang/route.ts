import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { listCabang, tambahCabang } from "@/services/cabang.service";
import { buatCabangSchema } from "@/validators/cabang";

export const runtime = "nodejs";

// Daftar cabang bimbel, diurutkan nama. Cabang bagian dari pengaturan bimbel,
// jadi hanya owner dan admin. Sumbernya tabel `cabang` lewat layanan cabang.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () =>
    Response.json({ data: await listCabang() }),
  );
}

// Menambah cabang baru. Nama yang sudah dipakai dijawab 409, sama seperti
// penambahan lewat halaman cabang.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const input = buatCabangSchema.parse(await readJson(request));
    const hasil = await tambahCabang(input);

    if (!hasil.ok) throw new ApiError(409, "NAMA_SUDAH_DIPAKAI", hasil.pesan);

    return Response.json({ data: hasil.cabang }, { status: 201 });
  });
}
