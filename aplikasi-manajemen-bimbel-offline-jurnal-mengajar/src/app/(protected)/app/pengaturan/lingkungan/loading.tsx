import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman status variabel lingkungan. */
export default function MemuatStatusVariabelLingkungan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memeriksa variabel lingkungan…" baris={3} />
    </div>
  );
}
