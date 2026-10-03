import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailJurnal } from "@/components/detail-jurnal";
import { getJurnalById } from "@/lib/mock-jurnal";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Detail Jurnal" };

export default async function DetailJurnalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const jurnal = getJurnalById(id);
  if (!jurnal) notFound();

  return <DetailJurnal jurnal={jurnal} />;
}
