import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman pengaturan bimbel. */
export default function MemuatPengaturan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat pengaturan…" baris={2} />
    </div>
  );
}
