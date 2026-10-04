import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RiwayatPerkembangan } from "@/components/riwayat-perkembangan";
import { PesanKosong } from "@/components/status-antarmuka";
import { listMurid } from "@/services/murid.service";
import { getRiwayatPerkembangan } from "@/services/perkembangan.service";

export const metadata: Metadata = { title: "Riwayat Perkembangan" };

export default async function RiwayatPerkembanganPage({
  searchParams,
}: {
  searchParams: Promise<{ murid?: string }>;
}) {
  // Izin `perkembangan: read` sudah diperiksa di layout seksi ini.
  const daftar = await listMurid({ limit: 100, offset: 0, cari: undefined });
  if (daftar.data.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 text-sm font-medium text-primary">
          Perkembangan Anak
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Riwayat Perkembangan
        </h1>
        <PesanKosong
          className="mt-6"
          judul="Belum ada murid"
          keterangan="Riwayat muncul setelah ada murid yang terdaftar dan dicatat perkembangannya."
        />
      </div>
    );
  }

  const params = await searchParams;
  // Anak yang dipilih hanya diterima kalau memang ada di daftar murid.
  const muridTerpilih =
    daftar.data.find((murid) => murid.id === params.murid) ?? daftar.data[0];

  const riwayat = await getRiwayatPerkembangan(muridTerpilih.id, 100, 0);
  if (!riwayat) notFound();

  return (
    <RiwayatPerkembangan
      daftarMurid={daftar.data}
      muridTerpilih={riwayat.murid}
      catatan={riwayat.catatan.data}
      kehadiran={riwayat.kehadiran.data}
    />
  );
}
