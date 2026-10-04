import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PresensiSesi } from "@/components/presensi-sesi";
import {
  FILTER_RIWAYAT_KOSONG,
  getJadwalHariIni,
  getRiwayatJurnal,
} from "@/lib/mock-jurnal";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, namaHari, tanggalISO } from "@/lib/tanggal";

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
  const hariIni = tanggalISO(sekarang);
  const jadwal = getJadwalHariIni(namaHari(sekarang)).find(
    (sesi) => sesi.id === jadwalId,
  );
  if (!jadwal) notFound();

  // Jurnal sesi ini (kalau sudah diisi) dipakai untuk tautan silang, supaya
  // presensi guru dan jurnal mengajar bisa ditelusuri dari dua arah.
  const jurnal =
    getRiwayatJurnal({
      ...FILTER_RIWAYAT_KOSONG,
      kelas: jadwal.namaKelas,
      dari: hariIni,
      sampai: hariIni,
    }).find(
      (catatan) =>
        catatan.jamMulai === jadwal.jamMulai &&
        catatan.jamSelesai === jadwal.jamSelesai,
    ) ?? null;

  return (
    <PresensiSesi
      jadwal={jadwal}
      jurnalId={jurnal?.id ?? null}
      namaGuru={user.name}
      tanggalTampil={formatTanggalLengkap(sekarang)}
    />
  );
}
