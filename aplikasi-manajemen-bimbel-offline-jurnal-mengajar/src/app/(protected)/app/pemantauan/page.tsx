import type { Metadata } from "next";
import { PemantauanHarian } from "@/components/pemantauan-harian";
import { requirePermission } from "@/lib/session";
import { formatTanggalLengkap, namaHari, tanggalISO } from "@/lib/tanggal";
import {
  listAnyJurnal,
  listAnyKehadiranJurnal,
  ringkasanAnyGuruHariIni,
  type KehadiranJurnal,
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

  const kehadiran: Record<string, KehadiranJurnal[]> = {};
  for (const baris of await listAnyKehadiranJurnal(
    hasil.data.map((jurnal) => jurnal.id),
  )) {
    kehadiran[baris.journalId] = [
      ...(kehadiran[baris.journalId] ?? []),
      { nama: baris.nama, hadir: baris.hadir, catatan: baris.catatan },
    ];
  }

  return (
    <PemantauanHarian
      data={hasil.data}
      statusGuru={statusGuru}
      kehadiran={kehadiran}
      tanggalTampil={formatTanggalLengkap(tanggal)}
      namaOwner={user.name}
      hasMore={hasil.meta.hasMore}
    />
  );
}
