import { TriangleAlert } from "lucide-react";

type PemberitahuanAnakNonaktifProps = {
  nama: string;
};

/**
 * Catatan saat anak yang sedang dibuka sudah tidak aktif di bimbel. Datanya
 * (jadwal, tagihan, catatan) tetap boleh dilihat sebagai riwayat, tetapi wali
 * perlu tahu bahwa tidak ada kegiatan baru yang akan menyusul sampai bimbel
 * mengaktifkannya lagi. Seluruh layar portal memakainya supaya keadaannya
 * seragam dan tidak bergantung pada satu halaman saja.
 */
export function PemberitahuanAnakNonaktif({
  nama,
}: PemberitahuanAnakNonaktifProps) {
  return (
    <p
      role="status"
      className="border-[var(--status-terlambat-garis)] bg-[var(--status-terlambat-latar)] text-[var(--status-terlambat-teks)] flex items-start gap-2 rounded-[var(--radius-kartu-portal)] border px-3 py-2 text-sm leading-6"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {nama} sudah tidak aktif di bimbel ini. Riwayat di bawah tetap bisa
        dilihat; hubungi bimbel kalau ada yang perlu ditanyakan.
      </span>
    </p>
  );
}
