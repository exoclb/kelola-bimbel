import type { Metadata } from "next";
import { RekapPemasukan } from "@/components/rekap-pemasukan";
import { requirePermission } from "@/lib/session";
import { formatPeriodeTagihan, periodeTagihan } from "@/lib/tagihan";
import { listTagihan } from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Rekap Pemasukan Bulanan" };

const POLA_TAHUN = /^\d{4}$/;

export default async function RekapPemasukanPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string }>;
}) {
  // Rekap pemasukan seluruh murid hanya untuk owner.
  await requirePermission({ tagihan: ["read-any"] });

  // Bulan dan tahun datang dari pemilih periode; kalau tidak sah, kembali ke
  // periode berjalan.
  const params = await searchParams;
  const bulan = Number(params.bulan);
  const periodeSah =
    Number.isInteger(bulan) &&
    bulan >= 1 &&
    bulan <= 12 &&
    POLA_TAHUN.test(params.tahun ?? "");
  const periode = periodeSah
    ? `${params.tahun}-${String(bulan).padStart(2, "0")}`
    : periodeTagihan(new Date());

  const daftar = await listTagihan({ periode });

  return (
    <RekapPemasukan
      daftar={daftar}
      periode={periode}
      periodeTampil={formatPeriodeTagihan(periode)}
    />
  );
}
