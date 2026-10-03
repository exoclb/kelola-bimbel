import type { Metadata } from "next";
import { RekapGajiSaya } from "@/components/rekap-gaji-saya";
import { formatPeriode, periodeBulan } from "@/lib/gaji";
import { getRekapGajiSaya } from "@/lib/mock-gaji";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Rekap Gaji Saya" };

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function RekapGajiSayaPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  // Data gaji di sini selalu milik akun yang sedang masuk, jadi cukup sesi.
  const { user } = await requireSession();

  const params = await searchParams;
  const periode = POLA_PERIODE.test(params.periode ?? "")
    ? (params.periode ?? "")
    : periodeBulan(new Date());
  const baris = getRekapGajiSaya(periode, {
    id: user.id,
    nama: user.name,
    email: user.email,
  });

  return (
    <RekapGajiSaya
      baris={baris}
      periodeTampil={formatPeriode(periode)}
      namaBerkas={`slip-gaji-${periode}`}
    />
  );
}
