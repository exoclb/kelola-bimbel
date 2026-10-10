import Link from "next/link";
import { ArrowRight, BellRing, UserRound } from "lucide-react";
import { FormUbahAkun } from "@/components/form-ubah-akun";
import { PenandaPengguna } from "@/components/penanda-pengguna";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JenisNotifikasi } from "@/lib/notifikasi";
import type { PeranPengguna } from "@/lib/peran";

/** Satu baris preferensi notifikasi akun ini (bentuk dari layanan pengaturan). */
export type RingkasPreferensi = {
  jenis: JenisNotifikasi;
  judul: string;
  aktif: boolean;
};

type AkunSayaProps = {
  nama: string;
  email: string;
  peran: PeranPengguna;
  /** Keadaan tersimpan tiap jenis pemberitahuan, hasil `ambilPreferensiNotifikasi()`. */
  preferensi: RingkasPreferensi[];
};

/**
 * Layar Akun Saya: identitas akun yang sedang masuk, formulir penggantian
 * namanya, dan ringkasan pilihan pemberitahuannya dengan tautan ke halaman
 * pengaturannya. Identitas dan pilihannya dibaca dari sesi serta tabel
 * `notification_preferences`; yang dikirim dari sini hanya nama lewat
 * `PATCH /api/pengaturan/akun`.
 */
export function AkunSaya({ nama, email, peran, preferensi }: AkunSayaProps) {
  const jumlahAktif = preferensi.filter((item) => item.aktif).length;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Pengaturan</p>
      <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Akun Saya
      </h1>
      <p className="text-base leading-7 text-muted-foreground">
        Identitas akun yang sedang masuk dan pilihan pemberitahuan yang ingin
        kamu terima.
      </p>

      <div className="mt-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden="true" className="size-5 text-primary" />
              Akun yang masuk
            </CardTitle>
            <CardDescription>
              Nama dan email ini yang dipakai di kepala halaman serta saat kamu
              menerima pemberitahuan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PenandaPengguna
              nama={nama}
              email={email}
              peran={peran}
              emailDiPonsel
            />
          </CardContent>
        </Card>

        <FormUbahAkun namaAwal={nama} email={email} peran={peran} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing aria-hidden="true" className="size-5 text-primary" />
              Preferensi Notifikasi
            </CardTitle>
            <CardDescription>
              {jumlahAktif} dari {preferensi.length} pemberitahuan menyala.
              Jenis yang dimatikan tidak akan muncul di panel pemberitahuanmu.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y">
              {preferensi.map((item) => (
                <li
                  key={item.jenis}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <span className="font-medium">{item.judul}</span>
                  <span
                    className={
                      item.aktif
                        ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {item.aktif ? "Menyala" : "Mati"}
                  </span>
                </li>
              ))}
            </ul>

            <Button asChild variant="outline" size="aksi">
              <Link href="/app/pengaturan/notifikasi">
                <BellRing aria-hidden="true" />
                Atur notifikasi
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
