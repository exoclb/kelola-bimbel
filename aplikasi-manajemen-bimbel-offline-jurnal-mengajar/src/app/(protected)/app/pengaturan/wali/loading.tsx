import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman daftar penautan akun wali. */
export default function MemuatPenautanWali() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat penautan akun wali…" baris={4} />
    </div>
  );
}
