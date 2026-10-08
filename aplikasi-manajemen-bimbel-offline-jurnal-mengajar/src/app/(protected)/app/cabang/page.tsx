import type { Metadata } from "next";
import { DaftarCabang } from "@/components/daftar-cabang";
import { jumlahKelasPerCabang } from "@/lib/ringkasan-cabang";
import { listCabang, ringkasCabang } from "@/services/cabang.service";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Daftar Cabang" };

export default async function CabangPage() {
  // Cabang bagian dari pengaturan bimbel, jadi hanya untuk owner.
  await requirePermission({ pengaturan: ["read"] });

  // Satu sumber untuk halaman ini dan `/api/cabang`: layanan cabang, yang
  // membaca tabel `cabang` di basis data. Jumlah kelas tiap cabang ikut dibaca
  // dari tabel `classes`, bukan dari data contoh kelas.
  const [daftar, ringkas, jumlahKelas] = await Promise.all([
    listCabang(),
    ringkasCabang(),
    jumlahKelasPerCabang(),
  ]);
  return (
    <DaftarCabang daftar={daftar} ringkas={ringkas} jumlahKelas={jumlahKelas} />
  );
}
