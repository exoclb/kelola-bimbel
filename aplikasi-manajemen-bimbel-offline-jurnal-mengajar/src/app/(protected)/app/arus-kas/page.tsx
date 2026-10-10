import type { Metadata } from "next";
import { ArusKas } from "@/components/arus-kas";
import { periodeBulan } from "@/lib/gaji";
import { requirePermission } from "@/lib/session";
import { rekapHonorBulanan } from "@/services/gaji.service";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";
import { ambilProfilBimbel } from "@/services/pengaturan.service";
import { rekapPemasukanPeriode } from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Arus Kas" };

const POLA_PERIODE = /^\d{4}-(0[1-9]|1[0-2])$/;
const POLA_TAHUN = /^\d{4}$/;

/**
 * Bulan terakhir tren dari alamat halaman. Halaman ini menerima dua gaya
 * alamat: `?periode=YYYY-MM` (tautan bulan sebelumnya/berikutnya) dan
 * `?bulan=&tahun=` dari pemilih periodenya, supaya tautan yang disalin tetap
 * bekerja. Alamat yang tidak sah diabaikan dan kembali ke bulan berjalan.
 */
function periodeDariAlamat(params: {
  periode?: string;
  bulan?: string;
  tahun?: string;
}) {
  if (params.periode && POLA_PERIODE.test(params.periode)) return params.periode;
  if (
    params.bulan &&
    params.tahun &&
    POLA_TAHUN.test(params.tahun) &&
    Number(params.bulan) >= 1 &&
    Number(params.bulan) <= 12
  ) {
    return `${params.tahun}-${params.bulan.padStart(2, "0")}`;
  }
  return null;
}

export default async function ArusKasPage({
  searchParams,
}: {
  searchParams: Promise<{
    periode?: string;
    bulan?: string;
    tahun?: string;
  }>;
}) {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  const params = await searchParams;
  const periodeBerjalan = periodeBulan(new Date());
  const periodeAkhir = periodeDariAlamat(params) ?? periodeBerjalan;

  // Pemasukan SPP, honor guru, dan pengeluaran operasional dibaca dari
  // database; komponennya hanya menyusun tampilan.
  const [rekapPengeluaran, rekapPemasukan, rekapHonor, profil] =
    await Promise.all([
      rekapPengeluaranBulanan(),
      rekapPemasukanPeriode(),
      rekapHonorBulanan(),
      ambilProfilBimbel(),
    ]);

  // Pilihan tahun dirakit dari periode yang benar-benar punya angka (tagihan,
  // honor, atau pengeluaran), ditambah tahun berjalan dan tahun yang sedang
  // dilihat, supaya bulan-bulan lama tetap bisa dibuka.
  const tahunTersedia = [
    ...new Set([
      new Date().getFullYear(),
      Number(periodeAkhir.slice(0, 4)),
      ...rekapPemasukan.map((baris) => Number(baris.periode.slice(0, 4))),
      ...rekapHonor.map((baris) => Number(baris.periode.slice(0, 4))),
      ...rekapPengeluaran.map((baris) => Number(baris.periode.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);

  return (
    <ArusKas
      rekapPengeluaran={rekapPengeluaran}
      rekapPemasukan={rekapPemasukan}
      rekapHonor={rekapHonor}
      periodeAkhir={periodeAkhir}
      periodeBerjalan={periodeBerjalan}
      tahunTersedia={tahunTersedia}
      profil={profil}
    />
  );
}
