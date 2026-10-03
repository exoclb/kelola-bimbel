import type { Metadata } from "next";
import { DaftarRiwayatJurnal } from "@/components/daftar-riwayat-jurnal";
import { getRiwayatJurnal } from "@/lib/mock-jurnal";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Riwayat Jurnal" };

export default async function RiwayatJurnalPage() {
  await requireSession();
  return <DaftarRiwayatJurnal daftar={getRiwayatJurnal()} />;
}
