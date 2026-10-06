import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman pengeluaran operasional. */
export default function MemuatPengeluaran() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat pengeluaran…" baris={4} />
    </div>
  );
}
