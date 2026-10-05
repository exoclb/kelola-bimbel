import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman tagihan SPP anak. */
export default function MemuatTagihanSpp() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat tagihan anak…" baris={4} />
    </div>
  );
}
