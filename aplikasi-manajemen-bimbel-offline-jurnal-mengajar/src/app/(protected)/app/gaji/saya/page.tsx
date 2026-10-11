import type { Metadata } from "next";
import { RekapGajiSaya } from "@/components/rekap-gaji-saya";
import { formatPeriode, periodeBulan } from "@/lib/gaji";
import { rekapGajiGuru } from "@/services/gaji.service";
import { ambilKopLaporan } from "@/services/kop-laporan.service";
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
  // Rekapnya dihitung dari jurnal guru itu sendiri, jadi angkanya sama dengan
  // yang dipakai owner menandai pembayaran di halaman rekap gaji.
  const baris = (
    await rekapGajiGuru(periode, {
      id: user.id,
      nama: user.name,
      email: user.email,
    })
  ).guru;

  return (
    <RekapGajiSaya
      baris={baris}
      periode={periode}
      periodeTampil={formatPeriode(periode)}
      namaBerkas={`slip-gaji-${periode}`}
      profil={await ambilKopLaporan()}
    />
  );
}
