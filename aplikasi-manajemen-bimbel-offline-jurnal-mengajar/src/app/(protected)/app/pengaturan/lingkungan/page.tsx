import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DaftarVariabelLingkungan } from "@/components/daftar-variabel-lingkungan";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/session";
import {
  bacaKondisiVariabelLingkungan,
  ringkasKondisiVariabelLingkungan,
} from "@/lib/variabel-lingkungan";

export const metadata: Metadata = { title: "Status Variabel Lingkungan" };

export default async function StatusVariabelLingkunganPage() {
  // Status lingkungan menyangkut seluruh penerapan, jadi hanya owner/admin.
  // Akun lain melihat halaman tidak ada (sama seperti halaman pengaturan lain).
  await requirePermission({ pengaturan: ["read"] });

  // Pemeriksaan dilakukan di server; yang dikirim ke komponen hanya nama
  // variabel, boolean terpasang, dan keterangannya — tanpa nilai apa pun.
  const daftar = bacaKondisiVariabelLingkungan();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/app/pengaturan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke pengaturan
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Status Variabel Lingkungan
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Ringkasan variabel yang dibaca aplikasi saat dijalankan. Berguna untuk
        mengecek penerapan baru: variabel wajib yang tertinggal langsung
        terlihat sebelum pengguna sempat mengeluh.
      </p>

      <div className="mt-8">
        <DaftarVariabelLingkungan
          daftar={daftar}
          ringkasan={ringkasKondisiVariabelLingkungan(daftar)}
        />
      </div>
    </div>
  );
}
