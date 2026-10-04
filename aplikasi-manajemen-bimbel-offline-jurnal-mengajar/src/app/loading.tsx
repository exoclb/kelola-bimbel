import { StatusMemuat } from "@/components/status-antarmuka";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <StatusMemuat
        judul="Menyiapkan halaman…"
        keterangan="Tunggu sebentar, datanya sedang diambil."
      />
    </div>
  );
}
