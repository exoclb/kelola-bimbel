import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman perkembangan anak. */
export default function MemuatPerkembangan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat catatan perkembangan…" baris={3} />
    </div>
  );
}
