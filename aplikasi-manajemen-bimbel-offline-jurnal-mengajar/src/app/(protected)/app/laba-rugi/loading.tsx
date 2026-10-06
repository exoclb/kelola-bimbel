import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman laporan laba rugi. */
export default function MemuatLabaRugi() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Menghitung laba rugi…" baris={4} />
    </div>
  );
}
