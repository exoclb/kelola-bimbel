import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PresensiSesi } from "@/components/presensi-sesi";
import { getJadwalHariIni } from "@/lib/mock-jurnal";
import { getPresensiGuruAwal } from "@/lib/mock-presensi-guru";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, namaHari } from "@/lib/tanggal";

export const metadata: Metadata = { title: "Presensi Sesi" };

export default async function PresensiSesiPage({
  params,
}: {
  params: Promise<{ jadwalId: string }>;
}) {
  const { user } = await requireSession();
  const { jadwalId } = await params;

  // Hanya sesi hari ini yang bisa dibuka, memakai sumber jadwal yang sama
  // dengan halaman presensi hari ini.
  const sekarang = new Date();
  const jadwal = getJadwalHariIni(namaHari(sekarang)).find(
    (sesi) => sesi.id === jadwalId,
  );
  if (!jadwal) notFound();

  const presensi =
    getPresensiGuruAwal().find((baris) => baris.jadwalId === jadwal.id) ?? null;

  return (
    <PresensiSesi
      jadwal={jadwal}
      presensiAwal={presensi}
      namaGuru={user.name}
      tanggalTampil={formatTanggalLengkap(sekarang)}
    />
  );
}
