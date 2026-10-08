import type { Metadata } from "next";
import { PresensiGuruHariIni } from "@/components/presensi-guru-hari-ini";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, tanggalISO } from "@/lib/tanggal";
import { listSesiPresensiGuru } from "@/services/presensi-guru.service";

export const metadata: Metadata = { title: "Presensi Guru" };

export default async function PresensiGuruPage() {
  const { user } = await requireSession();

  // Sesi hari ini dibaca dari jadwal mingguan guru yang sedang masuk, jadi
  // daftarnya sama dengan yang dipakai halaman jurnal dan presensi sesinya.
  const sekarang = new Date();
  const tanggal = tanggalISO(sekarang);
  const sesi = await listSesiPresensiGuru(user.id, tanggal);

  return (
    <PresensiGuruHariIni
      sesi={sesi}
      namaGuru={user.name}
      tanggal={tanggal}
      tanggalTampil={formatTanggalLengkap(sekarang)}
    />
  );
}
