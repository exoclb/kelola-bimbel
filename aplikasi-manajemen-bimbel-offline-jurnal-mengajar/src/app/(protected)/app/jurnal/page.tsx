import type { Metadata } from "next";
import { JurnalForm } from "@/components/jurnal-form";
import { getJadwalHariIni } from "@/lib/mock-jurnal";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, namaHari, tanggalISO } from "@/lib/tanggal";

export const metadata: Metadata = { title: "Jurnal Ngajar" };

export default async function JurnalPage() {
  const { user } = await requireSession();

  // Tanggal dihitung di server supaya tampilan dan data yang dikirim sama.
  const sekarang = new Date();
  const tanggal = tanggalISO(sekarang);
  const tanggalTampil = formatTanggalLengkap(sekarang);
  const hari = namaHari(sekarang);

  return (
    <JurnalForm
      jadwal={getJadwalHariIni(hari)}
      hari={hari}
      namaGuru={user.name}
      tanggal={tanggal}
      tanggalTampil={tanggalTampil}
    />
  );
}
