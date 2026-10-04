import type { Metadata } from "next";
import { PresensiGuruHariIni } from "@/components/presensi-guru-hari-ini";
import { getPresensiGuruAwal } from "@/lib/mock-presensi-guru";
import { getJadwalHariIni } from "@/lib/mock-jurnal";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, namaHari } from "@/lib/tanggal";

export const metadata: Metadata = { title: "Presensi Guru" };

export default async function PresensiGuruPage() {
  const { user } = await requireSession();

  // Sesi hari ini diambil dari jadwal mingguan yang sama dengan halaman jurnal,
  // supaya daftar sesinya tidak pernah berbeda.
  const sekarang = new Date();
  const jadwal = getJadwalHariIni(namaHari(sekarang));

  return (
    <PresensiGuruHariIni
      jadwal={jadwal}
      presensiAwal={getPresensiGuruAwal()}
      namaGuru={user.name}
      tanggalTampil={formatTanggalLengkap(sekarang)}
    />
  );
}
