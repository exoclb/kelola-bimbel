import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CircleHelp,
  TriangleAlert,
} from "lucide-react";
import { DaftarVerifikasiNotifikasi } from "@/components/daftar-verifikasi-notifikasi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  KASUS_VERIFIKASI,
  ringkasVerifikasi,
} from "@/lib/mock-verifikasi-notifikasi";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Verifikasi Notifikasi" };

export default async function VerifikasiNotifikasiPage() {
  // Ringkasan ini menyangkut pemberitahuan seluruh bimbel — penerimanya akun
  // lain juga — jadi hanya owner/admin, izin yang sama dengan Backup Database.
  await requirePermission({ pengaturan: ["read"] });

  const kasus = KASUS_VERIFIKASI;
  const ringkas = ringkasVerifikasi(kasus);

  const kartu = [
    {
      label: "Pemeriksaan lulus",
      nilai: `${ringkas.lulus} dari ${ringkas.total}`,
      keterangan: "Perilaku yang sudah dibuktikan dan dikunci tes.",
      ikon: BadgeCheck,
    },
    {
      label: "Perlu ditinjau",
      nilai: `${ringkas.perluDitinjau}`,
      keterangan:
        ringkas.perluDitinjau > 0
          ? "Ada yang perlu diputuskan sebelum dinyatakan selesai."
          : "Tidak ada temuan yang menggantung.",
      ikon: TriangleAlert,
    },
    {
      label: "Belum diperiksa",
      nilai: `${ringkas.belumDiperiksa}`,
      keterangan:
        ringkas.belumDiperiksa > 0
          ? "Menunggu bagian yang diperiksa tersedia di server."
          : "Semua bagian sudah diperiksa.",
      ikon: CircleHelp,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 print:hidden">
        <Button asChild variant="ghost" size="aksi" className="-ml-3">
          <Link href="/app/pengaturan">
            <ArrowLeft aria-hidden="true" />
            Kembali ke pengaturan
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">
        Pengaturan Bimbel
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Verifikasi Notifikasi
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Ringkasan pemeriksaan perilaku pemberitahuan: satu peristiwa hanya
        menghasilkan satu notifikasi, preferensi akun dihormati, penandaan baca
        tetap bekerja, dan aksi yang diulang tidak menggandakan. Setiap
        pemeriksaan menyebut sumber pemicunya supaya mudah ditelusuri.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {kartu.map(({ label, nilai, keterangan, ikon: Ikon }) => (
          <Card key={label} className="gap-1 px-5 py-4">
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Ikon className="size-4" aria-hidden="true" />
              {label}
            </p>
            <p className="text-2xl font-semibold tracking-tight">{nilai}</p>
            <p className="text-sm text-muted-foreground">{keterangan}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <DaftarVerifikasiNotifikasi kasus={kasus} />
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: belum ada API yang mengembalikan hasil pemeriksaan, jadi daftar
        dan angkanya masih ditulis tetap di{" "}
        <code>src/lib/mock-verifikasi-notifikasi.ts</code>. Pemeriksaan
        sungguhannya dijalankan tes di <code>e2e/notifikasi.spec.ts</code>,{" "}
        <code>tests/notifikasi-service.test.mjs</code>,{" "}
        <code>tests/notifikasi-gaji.test.mjs</code>, dan{" "}
        <code>tests/pesan-notifikasi.test.mjs</code>.
      </p>
    </div>
  );
}
