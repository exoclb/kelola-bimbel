import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat halaman buat tagihan bulanan. */
export default function MemuatBuatTagihan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Menyiapkan formulir tagihan…" baris={4} />
    </div>
  );
}
