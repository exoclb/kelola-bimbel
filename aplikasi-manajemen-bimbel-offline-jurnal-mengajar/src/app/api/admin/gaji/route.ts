import { ApiError, readJson, withApiPermission } from "@/lib/api";
import { periodeBulan } from "@/lib/gaji";
import {
  rekapGajiAnyBulanan,
  tandaiPembayaranGaji,
} from "@/services/gaji.service";
import { periodeGajiSchema, ubahPembayaranGajiSchema } from "@/validators/gaji";

export const runtime = "nodejs";

// Rekap gaji semua guru pada satu bulan. Gaji dihitung dari jam mengajar yang
// tercatat di jurnal dikalikan tarif yang berlaku untuk bulan itu. Membaca
// data gaji akun lain, jadi wajib izin `gaji: read-any`.
export function GET(request: Request) {
  return withApiPermission(request, { gaji: ["read-any"] }, async () => {
    const { periode } = periodeGajiSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({
      data: await rekapGajiAnyBulanan(periode ?? periodeBulan(new Date())),
    });
  });
}

// Menandai gaji satu guru pada satu bulan sebagai sudah dibayar (atau
// membatalkannya). Angka jam & tarif disalin saat itu sebagai bukti, dan
// mengirim ulang untuk guru & bulan yang sama memperbarui catatan yang ada.
export function PATCH(request: Request) {
  return withApiPermission(request, { gaji: ["read-any"] }, async () => {
    const input = ubahPembayaranGajiSchema.parse(await readJson(request));
    const hasil = await tandaiPembayaranGaji(
      input.guruId,
      input.periode,
      input.dibayar,
    );
    if (hasil.status === "guru_tidak_ada")
      throw new ApiError(404, "NOT_FOUND", "Guru tidak ditemukan.");

    return Response.json({ data: hasil.pembayaran });
  });
}
