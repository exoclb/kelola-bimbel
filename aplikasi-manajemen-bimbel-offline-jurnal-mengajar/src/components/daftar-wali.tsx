import Link from "next/link";
import { ArrowRight, Mail, Power, UserRound, Users } from "lucide-react";
import { AksiLepasTautanWali } from "@/components/aksi-lepas-tautan-wali";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormTambahTautanWali } from "@/components/form-tambah-tautan-wali";
import { FormTambahWali } from "@/components/form-tambah-wali";
import { PesanKosong } from "@/components/status-antarmuka";
import { RiwayatStatusWali } from "@/components/riwayat-status-wali";
import { SaklarAksesPortalWali } from "@/components/saklar-akses-portal-wali";
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
 * lewat `listAkunWali()`. Di atas daftar ada dua formulir berdampingan: yang
 * kiri membuat akun wali baru lewat `POST /api/wali`, yang kanan menautkan
 * akun yang sudah ada ke murid lewat `POST /api/wali/:id/murid`; keduanya
 * menyegarkan halaman ini sesudah tersimpan. Pencabutan satu tautan dan saklar
 * akses portal dikerjakan komponen klien di dalam tiap kartu, yang menyegarkan
 * halaman yang sama.
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
        Pengelolaan Akun Wali
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length > 0
          ? `${ringkas.jumlahAkun} akun wali · ${ringkas.jumlahPortalAktif} portal aktif · ${ringkas.jumlahPortalNonaktif} nonaktif · ${ringkas.jumlahTertaut} sudah tertaut · ${ringkas.jumlahMurid} murid tertaut.`
          : "Belum ada akun wali yang terdaftar."}
      </p>

      {/*
        Dua formulir berdampingan: membuat akun wali, lalu menautkan akun yang
        sudah ada ke murid. Di layar sempit keduanya bertumpuk supaya isiannya
        tetap lega, dan formulir penautan baru muncul kalau akun walinya ada.
      */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="judul-tambah-wali">
          <h2 id="judul-tambah-wali" className="sr-only">
            Tambah akun wali
          </h2>
          <FormTambahWali daftar={daftar} />
        </section>

        <section aria-labelledby="judul-tautan-wali" className="space-y-3">
          <h2 id="judul-tautan-wali" className="sr-only">
            Tautan wali–murid
          </h2>
          {daftar.length > 0 ? (
            <FormTambahTautanWali daftar={daftar} daftarMurid={daftarMurid} />
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Penautan anak terbuka setelah ada akun wali. Buat akun walinya
              dulu di formulir sebelah.
            </p>
          )}
        </section>
      </div>

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
                    <SaklarAksesPortalWali
                      waliId={wali.waliId}
                      namaWali={wali.nama}
                      aksesPortal={wali.aksesPortal}
                    />
                  </div>
                </div>

                <RiwayatStatusWali wali={wali} />

                <AksiLepasTautanWali
                  waliId={wali.waliId}
                  namaWali={wali.nama}
                  murid={wali.murid}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: akun wali, murid, dan penautannya dibaca langsung dari basis
        data. Tombol Lepas pada chip murid mencabut satu tautan tanpa menghapus
        akun atau muridnya. Saklar akses portal memakai status nonaktif akun:
        akun yang portalnya dimatikan tidak bisa masuk atau membuka portal,
        tetapi akun beserta tautannya tetap tersimpan.
      </p>
    </div>
  );
}
