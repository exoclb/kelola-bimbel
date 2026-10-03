import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman rekap gaji. */
export default function MemuatGaji() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat rekap gaji…" baris={4} />
    </div>
  );
}
