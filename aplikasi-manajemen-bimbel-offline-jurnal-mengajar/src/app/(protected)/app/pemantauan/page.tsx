import type { Metadata } from "next";
import { PemantauanHarian } from "@/components/pemantauan-harian";
import { ringkasanPerCabang } from "@/lib/ringkasan-cabang";
import { requirePermission } from "@/lib/session";
import { formatTanggalLengkap, namaHari, tanggalISO } from "@/lib/tanggal";
import {
  kelasKosongHariIni,
  listAnyJurnal,
  listAnyKehadiranJurnal,
  opsiSaringPemantauan,
  ringkasanAnyGuruHariIni,
  type KehadiranJurnal,
} from "@/services/pemantauan.service";
import { listNotifikasi } from "@/services/notifikasi.service";

export const metadata: Metadata = { title: "Pemantauan Harian" };

type PemantauanSearchParams = Promise<{
  classId?: string;
  guruId?: string;
  cabang?: string;
}>;

export default async function PemantauanPage({
  searchParams,
}: {
  searchParams: PemantauanSearchParams;
}) {
  // Halaman ini membaca jurnal guru lain. Tanpa izin `jurnal: read-any`
  // halamannya tampil sebagai not-found, jadi rutenya tidak bisa dipetakan.
  const { user } = await requirePermission({ jurnal: ["read-any"] });

  const sekarang = new Date();
  const tanggal = tanggalISO(sekarang);
  const params = await searchParams;
  const opsi = await opsiSaringPemantauan();
  const ringkasanCabang = ringkasanPerCabang();

  // Saringan hanya diterima kalau nilainya memang ada di daftar pilihan, jadi
  // nilai asing dari URL tidak pernah ikut menyaring apa pun.
  const nilai = {
    classId: opsi.daftarKelas.some((kelas) => kelas.classId === params.classId)
      ? (params.classId ?? "")
      : "",
    guruId: opsi.daftarGuru.some((guru) => guru.guruId === params.guruId)
      ? (params.guruId ?? "")
      : "",
    cabang: opsi.daftarCabang.some((cabang) => cabang.nama === params.cabang)
      ? (params.cabang ?? "")
      : "",
  };
  const adaSaringan = Boolean(nilai.classId || nilai.guruId || nilai.cabang);
  const filter = { tanggal, ...nilai };

  const hari = namaHari(sekarang);
  const [hasil, statusGuru, kelasKosong, notifikasi] = await Promise.all([
    listAnyJurnal({ ...filter, limit: 50, offset: 0 }),
    ringkasanAnyGuruHariIni(hari, filter),
    kelasKosongHariIni(hari, filter),
    // Antrean pemberitahuan milik owner yang sedang masuk.
    listNotifikasi(user.id, { limit: 5, offset: 0, belumDibaca: undefined }),
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
      kelasKosong={kelasKosong}
      notifikasi={notifikasi.data}
      belumDibaca={notifikasi.meta.belumDibaca}
      kehadiran={kehadiran}
      saring={{
        kelas: opsi.daftarKelas,
        guru: opsi.daftarGuru,
        cabang: opsi.daftarCabang,
        nilai,
        adaSaringan,
      }}
      ringkasanCabang={ringkasanCabang}
      tanggalTampil={formatTanggalLengkap(tanggal)}
      namaOwner={user.name}
      hasMore={hasil.meta.hasMore}
    />
  );
}
