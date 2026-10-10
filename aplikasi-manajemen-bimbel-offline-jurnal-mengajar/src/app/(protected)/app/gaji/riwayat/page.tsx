import type { Metadata } from "next";
import { RiwayatGaji } from "@/components/riwayat-gaji";
import { riwayatGajiAny } from "@/services/gaji.service";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Riwayat Gaji" };

const POLA_BULAN = /^(0[1-9]|1[0-2])$/;

export default async function RiwayatGajiPage({
  searchParams,
}: {
  searchParams: Promise<{ tahun?: string; bulan?: string }>;
}) {
  await requirePermission({ gaji: ["read-any"] });

  const params = await searchParams;
  const bulan = POLA_BULAN.test(params.bulan ?? "") ? (params.bulan ?? "") : "";
  const diminta = Number(params.tahun ?? "");

  // Tahun yang diminta hanya dipakai kalau di situ memang ada jurnal; kalau
  // tidak, halamannya jatuh ke tahun terbaru yang punya data supaya saringan
  // dan isinya tidak pernah saling bertentangan.
  const tahunAwal =
    Number.isInteger(diminta) && diminta >= 2000 && diminta <= 2100
      ? diminta
      : new Date().getFullYear();
  let hasil = await riwayatGajiAny(tahunAwal, bulan || undefined);
  if (hasil.tahunTersedia.length > 0 && !hasil.tahunTersedia.includes(tahunAwal)) {
    hasil = await riwayatGajiAny(hasil.tahunTersedia[0], bulan || undefined);
  }

  const tahun = hasil.tahunTersedia.includes(tahunAwal)
    ? tahunAwal
    : (hasil.tahunTersedia[0] ?? tahunAwal);

  return (
    <RiwayatGaji
      daftar={hasil.daftar}
      tahunTersedia={[...new Set([tahun, ...hasil.tahunTersedia])].sort(
        (a, b) => b - a,
      )}
      nilai={{ tahun, bulan }}
      adaSaringan={bulan !== ""}
    />
  );
}
