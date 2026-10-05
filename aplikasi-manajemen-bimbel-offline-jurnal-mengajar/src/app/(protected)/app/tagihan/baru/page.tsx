import type { Metadata } from "next";
import { FormTagihanBulanan } from "@/components/form-tagihan-bulanan";
import { getDaftarMurid } from "@/lib/mock-murid";
import { kelasMurid } from "@/lib/mock-penempatan";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Buat Tagihan Bulanan" };

export default async function BuatTagihanPage() {
  // Membuat tagihan murid hanya untuk owner.
  await requirePermission({ tagihan: ["write-any"] });

  // Murid yang bisa ditagih: yang masih aktif, lengkap dengan kelasnya.
  const murid = getDaftarMurid()
    .filter((anak) => anak.statusAktif)
    .map((anak) => ({
      id: anak.id,
      nama: anak.nama,
      namaOrangTua: anak.namaOrangTua,
      kelasNama: kelasMurid(anak.id)[0]?.kelas.namaKelas ?? "Belum ada kelas",
    }));
  const kelasTersedia = [...new Set(murid.map((anak) => anak.kelasNama))].sort(
    (a, b) => a.localeCompare(b, "id"),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Tagihan Murid</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Buat Tagihan Bulanan
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Tentukan periode dan nominal, centang murid yang ditagih, lalu simpan.
        Data di halaman ini masih tiruan.
      </p>
      <div className="mt-6">
        <FormTagihanBulanan murid={murid} kelasTersedia={kelasTersedia} />
      </div>
    </div>
  );
}
