import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat beranda portal wali. */
export default function MemuatPortalWali() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Menyiapkan portal wali…" baris={4} />
    </div>
  );
}
