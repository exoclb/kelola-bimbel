import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman rekap pemasukan bulanan. */
export default function MemuatRekapPemasukan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Menghitung rekap pemasukan…" baris={4} />
    </div>
  );
}
