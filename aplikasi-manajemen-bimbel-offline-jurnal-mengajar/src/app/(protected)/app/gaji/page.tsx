import type { Metadata } from "next";
import { RekapGajiBulanan } from "@/components/rekap-gaji-bulanan";
import { formatPeriode, periodeBulan } from "@/lib/gaji";
import { rekapGajiAnyBulanan } from "@/services/gaji.service";
import { ambilKopLaporan } from "@/services/kop-laporan.service";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Rekap Gaji Bulanan" };

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function RekapGajiPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  // Data gaji semua guru hanya untuk owner.
  const { user } = await requirePermission({ gaji: ["read-any"] });

  const params = await searchParams;
  const periode = POLA_PERIODE.test(params.periode ?? "")
    ? (params.periode ?? "")
    : periodeBulan(new Date());
  const [rekap, profil] = await Promise.all([
    rekapGajiAnyBulanan(periode),
    ambilKopLaporan(),
  ]);

  return (
    <RekapGajiBulanan
      rekap={rekap}
      periodeTampil={formatPeriode(periode)}
      namaOwner={user.name}
      profil={profil}
    />
  );
}
