import type { Metadata } from "next";
import { DaftarRiwayatJurnal } from "@/components/daftar-riwayat-jurnal";
import {
  getKelasRiwayat,
  getRiwayatJurnal,
  type FilterRiwayat,
} from "@/lib/mock-jurnal";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Riwayat Jurnal" };

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

type RiwayatSearchParams = Promise<{
  kelas?: string;
  dari?: string;
  sampai?: string;
}>;

export default async function RiwayatJurnalPage({
  searchParams,
}: {
  searchParams: RiwayatSearchParams;
}) {
  await requireSession();

  const params = await searchParams;
  const kelasTersedia = getKelasRiwayat();

  // Nilai dari URL dipakai hanya kalau bentuknya benar, supaya saringan tidak
  // pernah berisi kelas asing atau tanggal yang bukan tanggal.
  const kelas = kelasTersedia.includes(params.kelas ?? "")
    ? (params.kelas ?? "")
    : "";
  const dari = POLA_TANGGAL.test(params.dari ?? "") ? (params.dari ?? "") : "";
  const sampai = POLA_TANGGAL.test(params.sampai ?? "")
    ? (params.sampai ?? "")
    : "";
  const rentangTerbalik = Boolean(dari && sampai && dari > sampai);

  const untukQuery: FilterRiwayat = {
    kelas,
    dari: rentangTerbalik ? "" : dari,
    sampai: rentangTerbalik ? "" : sampai,
  };
  const untukForm: FilterRiwayat = { kelas, dari, sampai };

  return (
    <DaftarRiwayatJurnal
      daftar={getRiwayatJurnal(untukQuery)}
      kelasTersedia={kelasTersedia}
      filter={untukForm}
      adaSaringan={Boolean(kelas || dari || sampai)}
      pesanFilter={
        rentangTerbalik
          ? "Tanggal 'Dari' harus lebih awal daripada tanggal 'Sampai'."
          : undefined
      }
    />
  );
}
