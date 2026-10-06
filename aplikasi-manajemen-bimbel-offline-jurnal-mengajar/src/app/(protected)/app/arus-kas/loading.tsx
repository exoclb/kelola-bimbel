import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman arus kas. */
export default function MemuatArusKas() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Menyusun arus kas…" baris={4} />
    </div>
  );
}
