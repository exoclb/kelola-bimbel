import type { Metadata } from "next";
import { DaftarRiwayatKehadiran } from "@/components/daftar-riwayat-presensi-guru";
import { getRiwayatKehadiranGuru } from "@/lib/mock-presensi-guru";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Riwayat Kehadiran Guru" };

export default async function RiwayatKehadiranGuruPage() {
  await requireSession();

  return <DaftarRiwayatKehadiran daftar={getRiwayatKehadiranGuru()} />;
}
