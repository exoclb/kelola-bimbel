import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman kelola kategori pengeluaran. */
export default function MemuatKategoriPengeluaran() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat kategori…" baris={3} />
    </div>
  );
}
