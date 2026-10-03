import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat daftar murid. */
export default function MemuatMurid() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat daftar murid…" baris={4} />
    </div>
  );
}
