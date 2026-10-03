import type { Metadata } from "next";
import { JurnalForm } from "@/components/jurnal-form";
import { JADWAL_HARI_INI } from "@/lib/mock-jurnal";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Jurnal Ngajar" };

export default async function JurnalPage() {
  const { user } = await requireSession();

  // Tanggal dihitung di server supaya tampilan dan data yang dikirim sama.
  const sekarang = new Date();
  const tanggal = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sekarang);
  const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(sekarang);

  return (
    <JurnalForm
      jadwal={JADWAL_HARI_INI}
      namaGuru={user.name}
      tanggal={tanggal}
      tanggalTampil={tanggalTampil}
    />
  );
}
