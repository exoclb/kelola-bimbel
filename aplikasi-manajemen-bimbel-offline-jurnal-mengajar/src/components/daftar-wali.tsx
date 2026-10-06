import Link from "next/link";
import { ArrowRight, Mail, Phone, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import { ringkasPenautan, type AkunWali } from "@/lib/mock-wali";

type DaftarWaliProps = {
  daftar: AkunWali[];
};

/**
 * Daftar akun wali beserta murid yang tertaut padanya. Datanya masih contoh;
 * penambahan dan pencabutan penautan menyusul.
 */
export function DaftarWali({ daftar }: DaftarWaliProps) {
  const ringkas = ringkasPenautan(daftar);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/app/pengaturan">
            <ArrowRight className="rotate-180" aria-hidden="true" />
            Kembali ke pengaturan
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">Pengaturan Bimbel</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Penautan Akun Wali
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length > 0
          ? `${ringkas.jumlahAkun} akun wali · ${ringkas.jumlahTertaut} sudah tertaut · ${ringkas.jumlahBelumTertaut} belum tertaut · ${ringkas.jumlahMurid} murid tertaut.`
          : "Belum ada akun wali yang terdaftar."}
      </p>

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada akun wali"
          keterangan="Akun wali yang dibuat owner akan muncul di daftar sini."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((wali) => (
            <li key={wali.waliId}>
              <Card className="gap-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 font-medium">
                      <UserRound className="size-4" aria-hidden="true" />
                      {wali.nama}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="size-4" aria-hidden="true" />
                        {wali.email}
                      </span>
                      {wali.kontak && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-4" aria-hidden="true" />
                          {wali.kontak}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={
                      wali.murid.length > 0
                        ? "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        : "inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    <Users className="size-3.5" aria-hidden="true" />
                    {wali.murid.length > 0
                      ? `${wali.murid.length} murid`
                      : "Belum tertaut"}
                  </span>
                </div>

                {wali.murid.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {wali.murid.map((anak) => (
                      <li
                        key={anak.muridId}
                        className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {anak.nama} · {anak.kelasNama}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Akun ini belum ditautkan ke murid mana pun.
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: daftar penautan ini masih data tiruan — penambahan dan
        pencabutan penautan menyusul bersama penyimpanan ke database.
      </p>
    </div>
  );
}
