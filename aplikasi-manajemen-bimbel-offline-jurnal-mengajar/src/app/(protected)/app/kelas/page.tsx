import type { Metadata } from "next";
import { DaftarKelas } from "@/components/daftar-kelas";
import { getDaftarKelas } from "@/lib/mock-kelas";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Kelas & Jadwal" };

export default async function KelasPage() {
  // Guru dan owner sama-sama boleh melihat kelas; cukup sesi yang sah.
  await requireSession();
  return <DaftarKelas daftarAwal={getDaftarKelas()} />;
}
