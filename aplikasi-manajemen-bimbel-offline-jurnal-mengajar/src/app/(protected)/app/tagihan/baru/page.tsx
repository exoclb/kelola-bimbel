import type { Metadata } from "next";
import { FormTagihanBulanan } from "@/components/form-tagihan-bulanan";
import { requirePermission } from "@/lib/session";
import { periodeTagihan } from "@/lib/tagihan";
import { listKelas, listMuridKelas } from "@/services/kelas.service";
import { listMurid } from "@/services/murid.service";
import { daftarMuridSudahDitagih } from "@/services/tagihan.service";

export const metadata: Metadata = { title: "Buat Tagihan Bulanan" };

export default async function BuatTagihanPage() {
  // Membuat tagihan murid hanya untuk owner.
  await requirePermission({ tagihan: ["write-any"] });

  const periode = periodeTagihan(new Date());
  const [daftarMurid, daftarKelas, muridSudahDitagih] = await Promise.all([
    listMurid({ limit: 100, offset: 0, cari: undefined }),
    listKelas({ limit: 100, offset: 0, cari: undefined }),
    daftarMuridSudahDitagih({ periode }),
  ]);

  // Kelas aktif pertama tiap murid. Kelas tanpa murid aktif dilewati supaya
  // tidak ada kueri yang sia-sia.
  const kelasBerisiMurid = daftarKelas.data.filter(
    (kelas) => kelas.jumlahMurid > 0,
  );
  const penempatan = await Promise.all(
    kelasBerisiMurid.map((kelas) => listMuridKelas(kelas.id)),
  );
  const kelasPerMurid = new Map<string, string>();
  penempatan.forEach((muridDiKelas, urutan) => {
    for (const anak of muridDiKelas) {
      if (!kelasPerMurid.has(anak.muridId)) {
        kelasPerMurid.set(anak.muridId, kelasBerisiMurid[urutan].namaKelas);
      }
    }
  });

  // Murid yang bisa ditagih: yang masih aktif, lengkap dengan kelasnya.
  const murid = daftarMurid.data
    .filter((anak) => anak.statusAktif)
    .map((anak) => ({
      id: anak.id,
      nama: anak.nama,
      namaOrangTua: anak.namaOrangTua ?? "",
      kelasNama: kelasPerMurid.get(anak.id) ?? "Belum ada kelas",
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
      </p>
      <div className="mt-6">
        <FormTagihanBulanan
          murid={murid}
          kelasTersedia={kelasTersedia}
          muridSudahDitagih={muridSudahDitagih}
        />
      </div>
    </div>
  );
}
