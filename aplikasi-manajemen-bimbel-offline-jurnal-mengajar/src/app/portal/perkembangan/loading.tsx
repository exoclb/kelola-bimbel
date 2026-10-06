import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman perkembangan anak di portal wali. */
export default function MemuatPerkembanganAnak() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat perkembangan anak…" baris={4} />
    </div>
  );
}
