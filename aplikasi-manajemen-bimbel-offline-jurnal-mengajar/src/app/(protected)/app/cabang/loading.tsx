import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman daftar cabang. */
export default function MemuatCabang() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat daftar cabang…" baris={3} />
    </div>
  );
}
