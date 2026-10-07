import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman penempatan murid ke kelas. */
export default function MemuatPenempatan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat penempatan murid…" baris={4} />
    </div>
  );
}
