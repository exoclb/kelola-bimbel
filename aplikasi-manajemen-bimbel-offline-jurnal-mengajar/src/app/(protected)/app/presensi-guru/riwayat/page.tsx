import type { Metadata } from "next";
import { DaftarRiwayatKehadiran } from "@/components/daftar-riwayat-presensi-guru";
import { peranDariRole } from "@/lib/peran";
import { requireSession } from "@/lib/session";
import { listRiwayatKehadiranGuru } from "@/services/presensi-guru.service";

export const metadata: Metadata = { title: "Riwayat Kehadiran Guru" };

export default async function RiwayatKehadiranGuruPage() {
  const { user } = await requireSession();

  // Guru hanya melihat riwayat kehadirannya sendiri; owner dan admin boleh
  // melihat kehadiran semua guru (dipakai untuk pantauan).
  const lihatSemua = peranDariRole(user.role) === "owner";
  const { data, meta } = await listRiwayatKehadiranGuru(
    lihatSemua ? {} : { guruId: user.id },
  );

  return (
    <DaftarRiwayatKehadiran
      daftar={data}
      rekap={meta}
      cakupan={lihatSemua ? "Kehadiran semua guru." : `Kehadiran ${user.name}.`}
    />
  );
}
