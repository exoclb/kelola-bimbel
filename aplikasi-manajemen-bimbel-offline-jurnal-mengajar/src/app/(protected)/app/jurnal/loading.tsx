import { StatusMemuat } from "@/components/status-antarmuka";

/**
 * Tampilan memuat untuk seluruh halaman jurnal (isi jurnal, riwayat, dan
 * detail). Kerangkanya mengikuti bentuk halamannya supaya tata letak tidak
 * melompat saat data selesai dimuat.
 */
export default function MemuatJurnal() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat halaman jurnal…" baris={3} />
    </div>
  );
}
