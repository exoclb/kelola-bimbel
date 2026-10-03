import type { Metadata } from "next";
import { PemantauanHarian } from "@/components/pemantauan-harian";
import { requirePermission } from "@/lib/session";
import { formatTanggalLengkap, tanggalISO } from "@/lib/tanggal";
import { listAnyJurnal } from "@/services/jurnal.service";

export const metadata: Metadata = { title: "Pemantauan Harian" };

export default async function PemantauanPage() {
  // Halaman ini membaca jurnal guru lain. Tanpa izin `jurnal: read-any`
  // halamannya tampil sebagai not-found, jadi rutenya tidak bisa dipetakan.
  const { user } = await requirePermission({ jurnal: ["read-any"] });

  const tanggal = tanggalISO(new Date());
  const { data, meta } = await listAnyJurnal({ tanggal, limit: 50, offset: 0 });

  return (
    <PemantauanHarian
      data={data}
      tanggalTampil={formatTanggalLengkap(tanggal)}
      namaOwner={user.name}
      hasMore={meta.hasMore}
    />
  );
}
