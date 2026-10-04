import type { Metadata } from "next";
import { DaftarPerkembangan } from "@/components/daftar-perkembangan";
import { listMurid } from "@/services/murid.service";
import {
  listCatatanTerbaruPerMurid,
  listRingkasanPerkembangan,
} from "@/services/perkembangan.service";

export const metadata: Metadata = { title: "Perkembangan Anak" };

// Halaman ini menampilkan seluruh catatan yang ada, jadi saringannya kosong
// dan batasnya dinaikkan ke batas maksimum API.
const semuaCatatan = {
  limit: 100,
  offset: 0,
  muridId: undefined,
  dari: undefined,
  sampai: undefined,
  cari: undefined,
};

export default async function PerkembanganPage() {
  // Izin `perkembangan: read` sudah diperiksa di layout seksi ini.
  const [murid, ringkasan, catatanTerbaru] = await Promise.all([
    listMurid({ limit: 100, offset: 0, cari: undefined }),
    listRingkasanPerkembangan(semuaCatatan),
    listCatatanTerbaruPerMurid(),
  ]);

  return (
    <DaftarPerkembangan
      daftarMurid={murid.data.map((anak) => ({
        id: anak.id,
        nama: anak.nama,
      }))}
      ringkasan={ringkasan.data}
      catatanTerbaru={catatanTerbaru}
      jumlahMurid={murid.meta.total}
      jumlahCatatan={ringkasan.meta.totalCatatan}
    />
  );
}
