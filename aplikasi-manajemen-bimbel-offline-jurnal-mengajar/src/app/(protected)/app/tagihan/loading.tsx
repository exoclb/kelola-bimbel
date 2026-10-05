import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman daftar tagihan murid. */
export default function MemuatTagihan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat daftar tagihan…" baris={4} />
    </div>
  );
}
