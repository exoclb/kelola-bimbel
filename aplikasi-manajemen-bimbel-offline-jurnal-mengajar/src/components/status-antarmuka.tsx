import type { ReactNode } from "react";
import { AlertTriangle, LoaderCircle, PackageOpen } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "cn";

/**
 * Tiga keadaan antarmuka yang dipakai berulang di seluruh aplikasi: sedang
 * memuat, tidak ada isinya, dan gagal dimuat. Semuanya memakai bentuk yang
 * sama supaya pengguna mengenalinya di halaman mana pun.
 *
 * Komponennya presentasional (tanpa "use client"), jadi boleh dipakai dari
 * komponen server maupun klien.
 */

type StatusMemuatProps = {
  judul?: string;
  keterangan?: string;
  /** Berapa baris kerangka yang digambar; sesuaikan dengan bentuk datanya. */
  baris?: number;
  className?: string;
};

/** Kerangka saat data sedang diambil. */
export function StatusMemuat({
  judul = "Memuat data…",
  keterangan,
  baris = 3,
  className,
}: StatusMemuatProps) {
  return (
    <div role="status" aria-busy="true" className={cn("space-y-4", className)}>
      <span className="sr-only">{judul}</span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {judul}
      </div>
      {keterangan && (
        <p className="text-sm text-muted-foreground">{keterangan}</p>
      )}
      <div className="space-y-3">
        {Array.from({ length: baris }).map((_, urutan) => (
          <div
            key={urutan}
            className="h-14 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

type PesanKosongProps = {
  judul: string;
  keterangan: string;
  /** Langkah yang bisa dilakukan pengguna, mis. tombol "Tambah murid". */
  aksi?: ReactNode;
  className?: string;
};

/** Keadaan ketika permintaan berhasil tetapi belum ada isinya. */
export function PesanKosong({
  judul,
  keterangan,
  aksi,
  className,
}: PesanKosongProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed px-4 py-8 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground"
      >
        <PackageOpen className="size-5" />
      </span>
      <p className="font-medium">{judul}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
        {keterangan}
      </p>
      {aksi && <div className="mt-4 flex justify-center">{aksi}</div>}
    </div>
  );
}

type PesanGalatProps = {
  judul?: string;
  keterangan: string;
  /** Hal yang bisa dicoba lagi, mis. tombol "Coba lagi". */
  aksi?: ReactNode;
  className?: string;
};

/** Keadaan ketika pengambilan data gagal. */
export function PesanGalat({
  judul = "Data belum bisa dimuat",
  keterangan,
  aksi,
  className,
}: PesanGalatProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-5",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {judul}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {keterangan}
      </p>
      {aksi && <div className="mt-4">{aksi}</div>}
    </div>
  );
}

type PanelStatusProps = {
  judul: string;
  keterangan?: string;
  aksi?: ReactNode;
  children: ReactNode;
};

/** Pembungkus kartu untuk keadaan antarmuka, supaya jaraknya seragam. */
export function PanelStatus({
  judul,
  keterangan,
  aksi,
  children,
}: PanelStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{judul}</CardTitle>
        {keterangan && <CardDescription>{keterangan}</CardDescription>}
        {aksi && <CardAction>{aksi}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
