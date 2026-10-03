import type { Metadata } from "next";
import { PemantauanHarian } from "@/components/pemantauan-harian";
import { requirePermission } from "@/lib/session";
import { formatTanggalLengkap, namaHari, tanggalISO } from "@/lib/tanggal";
import {
  listAnyJurnal,
  ringkasanAnyGuruHariIni,
} from "@/services/jurnal.service";

export const metadata: Metadata = { title: "Pemantauan Harian" };

export default async function PemantauanPage() {
  // Halaman ini membaca jurnal guru lain. Tanpa izin `jurnal: read-any`
  // halamannya tampil sebagai not-found, jadi rutenya tidak bisa dipetakan.
  const { user } = await requirePermission({ jurnal: ["read-any"] });

  const sekarang = new Date();
  const tanggal = tanggalISO(sekarang);
  const [hasil, statusGuru] = await Promise.all([
    listAnyJurnal({ tanggal, limit: 50, offset: 0 }),
    ringkasanAnyGuruHariIni(namaHari(sekarang), tanggal),
  ]);

  return (
    <PemantauanHarian
      data={hasil.data}
      statusGuru={statusGuru}
      tanggalTampil={formatTanggalLengkap(tanggal)}
      namaOwner={user.name}
      hasMore={hasil.meta.hasMore}
    />
  );
}
