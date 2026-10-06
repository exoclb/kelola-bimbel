import type { Metadata } from "next";
import { DaftarRiwayatKehadiran } from "@/components/daftar-riwayat-presensi-guru";
import { getRiwayatKehadiranGuru } from "@/lib/mock-presensi-guru";
import { peranDariRole } from "@/lib/peran";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Riwayat Kehadiran Guru" };

export default async function RiwayatKehadiranGuruPage() {
  const { user } = await requireSession();

  // Guru hanya melihat riwayat kehadirannya sendiri; owner dan admin boleh
  // melihat kehadiran semua guru (dipakai untuk pantauan).
  const lihatSemua = peranDariRole(user.role) === "owner";
  const semua = getRiwayatKehadiranGuru();
  const daftar = lihatSemua
    ? semua
    : semua.filter((baris) => baris.guruNama === user.name);

  return (
    <DaftarRiwayatKehadiran
      daftar={daftar}
      cakupan={lihatSemua ? "Kehadiran semua guru." : `Kehadiran ${user.name}.`}
    />
  );
}
