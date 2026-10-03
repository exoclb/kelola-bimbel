import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat daftar kelas beserta jadwalnya. */
export default function MemuatKelas() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat daftar kelas…" baris={4} />
    </div>
  );
}
