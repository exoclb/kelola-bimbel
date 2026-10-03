import type { Metadata } from "next";
import { DaftarMurid } from "@/components/daftar-murid";
import { getDaftarMurid } from "@/lib/mock-murid";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Daftar Murid" };

export default async function DaftarMuridPage() {
  // Guru dan owner sama-sama boleh melihat data murid; cukup sesi yang sah.
  await requireSession();
  return <DaftarMurid daftarAwal={getDaftarMurid()} />;
}
