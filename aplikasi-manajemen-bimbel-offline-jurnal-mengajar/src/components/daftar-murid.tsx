import { CalendarDays, Phone, UserRound } from "lucide-react";
import { cn } from "cn";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Murid } from "@/lib/mock-murid";
import { formatTanggalLengkap, hitungUsia } from "@/lib/tanggal";

type DaftarMuridProps = {
  daftar: Murid[];
};

/**
 * Daftar murid bimbel: data tiap anak, orang tua yang bisa dihubungi, dan
 * statusnya masih aktif atau tidak.
 */
export function DaftarMurid({ daftar }: DaftarMuridProps) {
  const aktif = daftar.filter((murid) => murid.statusAktif).length;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">
        Data Murid &amp; Kelas
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Daftar Murid
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length === 0
          ? "Belum ada murid yang terdaftar."
          : `${daftar.length} murid terdaftar · ${aktif} masih aktif.`}
      </p>

      {daftar.length === 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Belum ada murid</CardTitle>
            <CardDescription>
              Data murid muncul di sini setelah ditambahkan.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="mt-8 space-y-3">
          {daftar.map((murid) => (
            <li key={murid.id}>
              <Card className="gap-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{murid.nama}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" aria-hidden="true" />
                        {formatTanggalLengkap(murid.tanggalLahir)} ·{" "}
                        {hitungUsia(murid.tanggalLahir)} tahun
                      </span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                      murid.statusAktif
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {murid.statusAktif ? "Aktif" : "Tidak aktif"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="size-4" aria-hidden="true" />
                    {murid.namaOrangTua}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-4" aria-hidden="true" />
                    {murid.kontakOrangTua}
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
