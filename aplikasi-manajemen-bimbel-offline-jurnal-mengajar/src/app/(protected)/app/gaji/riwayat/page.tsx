import type { Metadata } from "next";
import { RiwayatGaji } from "@/components/riwayat-gaji";
import { getRiwayatGaji } from "@/lib/mock-gaji";
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
  const semua = getRiwayatGaji();
  const tahunTersedia = [
    ...new Set(semua.map((baris) => Number(baris.periode.slice(0, 4)))),
  ].sort((a, b) => b - a);

  // Nilai saringan hanya dipakai kalau memang ada di daftar pilihan.
  const tahunDiminta = Number(params.tahun ?? "");
  const tahun = tahunTersedia.includes(tahunDiminta)
    ? tahunDiminta
    : (tahunTersedia[0] ?? new Date().getFullYear());
  const bulan = POLA_BULAN.test(params.bulan ?? "") ? (params.bulan ?? "") : "";

  const daftar = semua.filter(
    (baris) =>
      Number(baris.periode.slice(0, 4)) === tahun &&
      (!bulan || baris.periode.slice(5, 7) === bulan),
  );

  return (
    <RiwayatGaji
      daftar={daftar}
      tahunTersedia={tahunTersedia}
      nilai={{ tahun, bulan }}
      adaSaringan={bulan !== ""}
    />
  );
}
