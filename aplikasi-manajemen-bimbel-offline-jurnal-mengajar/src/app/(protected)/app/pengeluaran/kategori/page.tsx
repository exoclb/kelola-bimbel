import type { Metadata } from "next";
import { KelolaKategoriPengeluaran } from "@/components/kelola-kategori-pengeluaran";
import { requirePermission } from "@/lib/session";
import { ringkasanKategoriPengeluaran } from "@/services/pengeluaran.service";

export const metadata: Metadata = { title: "Kategori Pengeluaran" };

export default async function KategoriPengeluaranPage() {
  // Kategori pengeluaran hanya untuk owner, sama seperti halaman pengeluarannya.
  await requirePermission({ pengeluaran: ["read-any"] });

  // Kategori beserta jumlah catatan dan total nominalnya dibaca dari tabel
  // `expense_categories` + `expenses`; komponennya hanya menyusun tampilan.
  const daftar = await ringkasanKategoriPengeluaran();

  return <KelolaKategoriPengeluaran daftar={daftar} />;
}
