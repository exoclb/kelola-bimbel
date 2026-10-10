import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailMurid } from "@/components/detail-murid";
import { getDaftarKelas } from "@/lib/mock-kelas";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getPenempatanAwal } from "@/lib/mock-penempatan";
import { requireSession } from "@/lib/session";

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
      penempatanAwal={getPenempatanAwal()}
    />
  );
}
