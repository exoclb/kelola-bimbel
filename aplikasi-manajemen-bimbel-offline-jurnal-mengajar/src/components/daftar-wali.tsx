import Link from "next/link";
import { ArrowRight, Mail, Power, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormTambahTautanWali } from "@/components/form-tambah-tautan-wali";
import { PesanKosong } from "@/components/status-antarmuka";
import type { AkunWali, MuridRingkas } from "@/services/wali.service";

type DaftarWaliProps = {
  /** Akun wali dari basis data, urut nama. */
  daftar: AkunWali[];
  /** Semua murid yang bisa dipilih saat menambah tautan, urut nama. */
  daftarMurid: MuridRingkas[];
};

/** Ringkasan singkat isi daftar: jumlah akun, portal, dan murid tertaut. */
function ringkasPenautan(daftar: AkunWali[]) {
  return {
    jumlahAkun: daftar.length,
    jumlahPortalAktif: daftar.filter((wali) => wali.aksesPortal).length,
    jumlahPortalNonaktif: daftar.filter((wali) => !wali.aksesPortal).length,
    jumlahTertaut: daftar.filter((wali) => wali.murid.length > 0).length,
    jumlahMurid: daftar.reduce((jumlah, wali) => jumlah + wali.murid.length, 0),
  };
}

/**
 * Daftar akun wali beserta murid yang tertaut padanya, dibaca dari basis data
 * lewat `listAkunWali()`. Taulannya ditambah lewat formulir di atas daftar,
 * yang mengirim ke `POST /api/wali/:id/murid` lalu menyegarkan halaman ini.
 */
export function DaftarWali({ daftar, daftarMurid }: DaftarWaliProps) {
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
          ? `${ringkas.jumlahAkun} akun wali · ${ringkas.jumlahPortalAktif} portal aktif · ${ringkas.jumlahPortalNonaktif} nonaktif · ${ringkas.jumlahTertaut} sudah tertaut · ${ringkas.jumlahMurid} murid tertaut.`
          : "Belum ada akun wali yang terdaftar."}
      </p>

      {daftar.length > 0 && (
        <div className="mt-6">
          <FormTambahTautanWali daftar={daftar} daftarMurid={daftarMurid} />
        </div>
      )}

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
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
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
                    <span
                      className={
                        wali.aksesPortal
                          ? "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          : "inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
                      }
                    >
                      <Power className="size-3.5" aria-hidden="true" />
                      {wali.aksesPortal ? "Portal aktif" : "Portal nonaktif"}
                    </span>
                  </div>
                </div>

                {wali.murid.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {wali.murid.map((anak) => (
                      <li
                        key={anak.muridId}
                        className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {anak.nama}
                        {anak.statusAktif ? "" : " · tidak aktif"}
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
        Catatan: akun wali, murid, dan penautannya dibaca langsung dari basis
        data. Pencabutan tautan dan pengaturan akses portal menyusul di fase
        berikutnya.
      </p>
    </div>
  );
}
