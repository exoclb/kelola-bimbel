import { StatusMemuat } from "@/components/status-antarmuka";

/** Tampilan memuat dasbor pemantauan owner. */
export default function MemuatPemantauan() {
  return (
    <div className="mx-auto max-w-3xl">
      <StatusMemuat judul="Memuat pantauan hari ini…" baris={4} />
    </div>
  );
}
