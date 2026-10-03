import {
  ApiError,
  readJson,
  withApiPermission,
  withApiSession,
} from "@/lib/api";
import {
  ambilAturanGaji,
  tambahAturanGaji,
} from "@/services/pengaturan.service";
import { tanggalISO } from "@/lib/tanggal";
import {
  aturanGajiSchema,
  listAturanGajiSchema,
} from "@/validators/pengaturan";

export const runtime = "nodejs";

// Aturan gaji yang berlaku pada satu tanggal (`?tanggal=YYYY-MM-DD`, bawaan
// hari ini) beserta seluruh riwayatnya. Boleh dibaca semua akun: tarifnya juga
// muncul di rekap gaji milik guru sendiri.
export function GET(request: Request) {
  return withApiSession(request, async () => {
    const { tanggal } = listAturanGajiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({
      data: await ambilAturanGaji(tanggal ?? tanggalISO(new Date())),
    });
  });
}

// Menambah aturan gaji baru. Hanya owner dan admin: tarif ini dipakai menghitung
// gaji semua guru.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () => {
    const input = aturanGajiSchema.parse(await readJson(request));
    const hasil = await tambahAturanGaji(input);

    if (hasil.status === "tanggal_sudah_ada")
      throw new ApiError(
        409,
        "TANGGAL_SUDAH_ADA",
        "Sudah ada aturan gaji yang mulai berlaku pada tanggal itu.",
      );

    return Response.json({ data: hasil.aturan }, { status: 201 });
  });
}
