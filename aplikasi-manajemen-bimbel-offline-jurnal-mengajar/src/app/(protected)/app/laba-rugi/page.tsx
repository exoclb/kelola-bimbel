import type { Metadata } from "next";
import { LaporanLabaRugi } from "@/components/laporan-laba-rugi";
import { periodeBulan } from "@/lib/gaji";
import { ringkasanLabaRugi } from "@/lib/laporan-bulanan";
import { requirePermission } from "@/lib/session";
import { rekapHonorBulanan } from "@/services/gaji.service";
import { beritahuLaporanBulanan } from "@/services/notifikasi.service";
import { rekapPengeluaranBulanan } from "@/services/pengeluaran.service";
import { rekapPemasukanPeriode } from "@/services/tagihan.service";
import { ambilProfilBimbel } from "@/services/pengaturan.service";

export const metadata: Metadata = { title: "Laporan Laba Rugi" };

export default async function LabaRugiPage() {
  // Laporan keuangan bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Pemasukan SPP, honor guru, dan pengeluaran operasional dibaca dari
  // database; komponennya hanya menyusun tampilan.
  const [rekapPengeluaran, rekapPemasukan, rekapHonor] = await Promise.all([
    rekapPengeluaranBulanan(),
    rekapPemasukanPeriode(),
    rekapHonorBulanan(),
  ]);

  // Pemicu notifikasi laporan bulanan: laporan bulan berjalan sudah selesai
  // dihitung tepat di sini, jadi angkanya dipakai apa adanya. Kuncinya satu per
  // periode, sehingga membuka ulang halaman ini tidak menambah pemberitahuan
  // kedua, dan jenis `laporan_bulanan` bawaannya mati — hanya pemilik yang
  // menyalakannya yang menerima.
  const periodeBerjalan = periodeBulan(new Date());
  await beritahuLaporanBulanan(
    periodeBerjalan,
    ringkasanLabaRugi({
      pemasukan:
        rekapPemasukan.find((baris) => baris.periode === periodeBerjalan)
          ?.nominalLunas ?? 0,
      biayaHonor:
        rekapHonor.find((baris) => baris.periode === periodeBerjalan)?.total ??
        0,
      biayaOperasional:
        rekapPengeluaran.find((baris) => baris.periode === periodeBerjalan)
          ?.total ?? 0,
    }),
  );

  const profil = await ambilProfilBimbel();

  return (
    <LaporanLabaRugi
      rekapPengeluaran={rekapPengeluaran}
      rekapPemasukan={rekapPemasukan}
      rekapHonor={rekapHonor}
      profil={profil}
    />
  );
}
