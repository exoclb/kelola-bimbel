import type { Metadata } from "next";
import { DaftarPengeluaran } from "@/components/daftar-pengeluaran";
import { periodePengeluaran } from "@/lib/pengeluaran";
import { requirePermission } from "@/lib/session";
import {
  listKategoriPengeluaran,
  listPengeluaran,
} from "@/services/pengeluaran.service";

export const metadata: Metadata = { title: "Pengeluaran Operasional" };

export default async function PengeluaranPage() {
  // Pengeluaran bimbel hanya untuk owner.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Tanpa saringan, halaman menampilkan periode berjalan; seluruh baris dibaca
  // supaya saringan bulan di tampilan bisa berpindah tanpa memuat ulang data.
  const periode = periodePengeluaran(new Date());
  const [daftar, kategori] = await Promise.all([
    listPengeluaran({}),
    listKategoriPengeluaran(),
  ]);

  return (
    <DaftarPengeluaran daftar={daftar} kategori={kategori} periode={periode} />
  );
}
