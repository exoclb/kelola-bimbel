import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailMurid } from "@/components/detail-murid";
import { getDaftarKelas } from "@/lib/mock-kelas";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getPenempatanAwal } from "@/lib/mock-penempatan";
import { requireSession } from "@/lib/session";
import { listCabang } from "@/services/cabang.service";

export const metadata: Metadata = { title: "Detail Murid" };

export default async function DetailMuridPage({
  params,
}: {
  params: Promise<{ muridId: string }>;
}) {
  await requireSession();

  const { muridId } = await params;
  const murid = getDaftarMurid().find((anak) => anak.id === muridId);
  if (!murid) notFound();

  return (
    <DetailMurid
      muridAwal={murid}
      daftarKelas={getDaftarKelas()}
      // Status cabang dibaca di server dari layanan cabang, jadi pilihan kelas
      // di halaman ini menilai cabang dengan data yang sama seperti halaman
      // cabang dan formulir kelas.
      daftarCabang={await listCabang()}
      penempatanAwal={getPenempatanAwal()}
    />
  );
}
