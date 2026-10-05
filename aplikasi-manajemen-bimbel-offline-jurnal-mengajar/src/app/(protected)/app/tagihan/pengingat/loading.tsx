import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman daftar tagihan menunggak. */
export default function MemuatTagihanMenunggak() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Mengumpulkan tagihan menunggak…" baris={4} />
    </div>
  );
}
