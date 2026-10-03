import type { Metadata } from "next";
import { RekapGajiBulanan } from "@/components/rekap-gaji-bulanan";
import { formatPeriode, periodeBulan } from "@/lib/gaji";
import { getRekapGajiBulanan } from "@/lib/mock-gaji";
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

  return (
    <RekapGajiBulanan
      rekap={getRekapGajiBulanan(periode)}
      periodeTampil={formatPeriode(periode)}
      namaOwner={user.name}
    />
  );
}
