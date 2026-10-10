"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BellRing,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  PiggyBank,
  Undo2,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LabelStatusTagihan } from "@/components/label-status-tagihan";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import {
  formatPeriodeTagihan,
  geserPeriode,
  hitungRekapTagihan,
  menunggak,
  periodeDariTagihan,
  type Tagihan,
} from "@/lib/tagihan";
import { tanggalISO } from "@/lib/tanggal";

type DaftarTagihanProps = {
  daftar: Tagihan[];
  periode: string;
  periodeTampil: string;
  /** Periode berjalan, dipakai tombol kembali dan penanda tunggakan. */
  periodeSekarang: string;
  /** Tahun yang boleh dipilih pemilih periode (berisi tahun berjalan). */
  tahunTersedia: number[];
  muridSudahDitagih: string[];
};

/** Saringan status di layar; nilainya sama dengan kolom `student_invoices`. */
type Saringan = "semua" | "belum_lunas" | "lunas";

const NAMA_BULAN = new Intl.DateTimeFormat("id-ID", { month: "long" });
const bulanTampil = (bulan: number) =>
  NAMA_BULAN.format(new Date(2026, bulan - 1, 1));

const tanggalTampil = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Daftar tagihan bulanan murid untuk satu periode. Tagihan yang belum lunas
 * ditandai garis kiri merah dan latar tipis, sedangkan yang lunas tampil biasa,
 * jadi bedanya terlihat sekilas tanpa mengandalkan warna saja. Datanya dibaca
 * dari server, dan penandaan lunas dikirim ke API lalu halaman dimuat ulang.
 */
export function DaftarTagihan({
  daftar,
  periode,
  periodeTampil,
  periodeSekarang,
  tahunTersedia,
}: DaftarTagihanProps) {
  const router = useRouter();

  // Tagihan yang sedang ditandai lunas, dan tanggal bayar yang diisi owner.
  const [bukaId, setBukaId] = useState<string | null>(null);
  const [tanggalBayar, setTanggalBayar] = useState(tanggalISO(new Date()));
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Tagihan yang status lunasnya sedang dikonfirmasi untuk dibatalkan.
  const [batalId, setBatalId] = useState<string | null>(null);
  // Saringan status di layar, supaya tagihan yang belum lunas tetap mudah
  // ditemukan pada periode yang ramai.
  const [saring, setSaring] = useState<Saringan>("semua");

  const rekap = hitungRekapTagihan(daftar);
  const [tahunTerpilih, bulanTerpilih] = periode.split("-").map(Number);
  const periodeBerjalan = periode === periodeSekarang;

  const tampil =
    saring === "semua"
      ? daftar
      : daftar.filter((baris) => baris.status === saring);

  const pilihanSaring = [
    { nilai: "semua" as const, label: "Semua", jumlah: rekap.jumlah },
    {
      nilai: "belum_lunas" as const,
      label: "Belum lunas",
      jumlah: rekap.jumlahBelumLunas,
    },
    { nilai: "lunas" as const, label: "Sudah lunas", jumlah: rekap.jumlahLunas },
  ];

  async function ubahStatus(
    tagihan: Tagihan,
    muatan:
      { status: "lunas"; tanggalBayar?: string } | { status: "belum_lunas" },
    sukses: string,
  ) {
    if (pendingId) return;
    setPendingId(tagihan.id);
    setGalat("");
    try {
      const jawaban = await fetch(`/api/tagihan/${tagihan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(muatan),
      });
      if (!jawaban.ok) throw new Error("gagal");
      setPesan(sukses);
      setBukaId(null);
      router.refresh();
    } catch {
      setGalat(`Gagal memperbarui tagihan ${tagihan.muridNama}. Coba lagi.`);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Tagihan Murid</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Daftar Tagihan
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-7 text-muted-foreground">
          {rekap.jumlah > 0
            ? `${rekap.jumlah} tagihan bulan ${periodeTampil} · ${rekap.jumlahLunas} lunas · ${rekap.jumlahBelumLunas} belum lunas.`
            : `Belum ada tagihan yang tercatat untuk bulan ${periodeTampil}.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="aksi">
            <Link href="/app/tagihan/pengingat">
              <BellRing aria-hidden="true" />
              Menunggak
            </Link>
          </Button>
          <Button asChild variant="outline" size="aksi">
            <Link href="/app/tagihan/rekap">
              <PiggyBank aria-hidden="true" />
              Rekap pemasukan
            </Link>
          </Button>
          <Button asChild size="aksi">
            <Link href="/app/tagihan/baru">
              <CalendarPlus aria-hidden="true" />
              Buat tagihan
            </Link>
          </Button>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pilih periode</CardTitle>
          <CardDescription>
            Tagihan dibaca per bulan, dan statusnya bisa diubah untuk periode
            mana pun — termasuk bulan-bulan yang sudah lewat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulan">Bulan</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="bulan"
                name="bulan"
                defaultValue={bulanTerpilih}
              >
                {Array.from({ length: 12 }, (_, urutan) => urutan + 1).map(
                  (nilai) => (
                    <option key={nilai} value={nilai}>
                      {bulanTampil(nilai)}
                    </option>
                  ),
                )}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tahun">Tahun</Label>
              <NativeSelect
                className="h-[var(--target-sentuh-portal)] md:text-base"
                id="tahun"
                name="tahun"
                defaultValue={tahunTerpilih}
              >
                {tahunTersedia.map((nilai) => (
                  <option key={nilai} value={nilai}>
                    {nilai}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <Button type="submit" size="aksi">
                <Filter aria-hidden="true" />
                Tampilkan
              </Button>
              <Button asChild variant="outline" size="aksi">
                <Link href={`/app/tagihan?periode=${geserPeriode(periode, -1)}`}>
                  <ChevronLeft aria-hidden="true" />
                  Bulan sebelumnya
                </Link>
              </Button>
              <Button asChild variant="outline" size="aksi">
                <Link href={`/app/tagihan?periode=${geserPeriode(periode, 1)}`}>
                  Bulan berikutnya
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
              {!periodeBerjalan && (
                <Button asChild variant="ghost" size="aksi">
                  <Link href="/app/tagihan">Kembali ke periode berjalan</Link>
                </Button>
              )}
            </div>
          </form>
          {!periodeBerjalan && (
            <p className="mt-3 text-sm text-muted-foreground">
              {rekap.jumlahBelumLunas > 0
                ? `${rekap.jumlahBelumLunas} tagihan ${periodeTampil} belum lunas dan sudah lewat jatuh temponya; tandai lunas dari barisnya kalau pembayarannya menyusul.`
                : `Tidak ada tagihan ${periodeTampil} yang tertinggal.`}
            </p>
          )}
        </CardContent>
      </Card>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
      </p>
      {galat && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {galat}
        </p>
      )}

      {rekap.jumlah > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">Sudah lunas</p>
            <p className="text-xl font-semibold">
              {formatRupiah(rekap.nominalLunas)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rekap.jumlahLunas} tagihan
            </p>
          </Card>
          <Card className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">Belum lunas</p>
            <p className="text-xl font-semibold">
              {formatRupiah(rekap.nominalBelumLunas)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rekap.jumlahBelumLunas} tagihan
            </p>
          </Card>
          <Card className="gap-1 px-5 py-4">
            <p className="text-sm text-muted-foreground">Total periode</p>
            <p className="text-xl font-semibold">
              {formatRupiah(rekap.nominalLunas + rekap.nominalBelumLunas)}
            </p>
            <p className="text-xs text-muted-foreground">
              {rekap.jumlah} tagihan
            </p>
          </Card>
        </div>
      )}

      {daftar.length > 0 && (
        <div
          role="group"
          aria-label="Saring status tagihan"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          {pilihanSaring.map((pilihan) => (
            <Button
              key={pilihan.nilai}
              type="button"
              variant={saring === pilihan.nilai ? "default" : "outline"}
              size="aksi"
              aria-pressed={saring === pilihan.nilai}
              onClick={() => setSaring(pilihan.nilai)}
            >
              {pilihan.label} ({pilihan.jumlah})
            </Button>
          ))}
        </div>
      )}

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul={`Belum ada tagihan ${periodeTampil}`}
          keterangan="Tekan Buat tagihan untuk menerbitkan tagihan periode ini."
        />
      ) : tampil.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul={
            saring === "lunas"
              ? "Belum ada tagihan lunas"
              : `Semua tagihan ${periodeTampil} sudah lunas`
          }
          keterangan={
            saring === "lunas"
              ? "Belum ada tagihan periode ini yang ditandai lunas."
              : "Tidak ada tagihan yang menunggu pembayaran pada periode ini."
          }
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {tampil.map((tagihan) => {
            const lunas = tagihan.status === "lunas";
            const pending = pendingId === tagihan.id;
            return (
              <li key={tagihan.id}>
                <Card
                  className={cn(
                    "gap-3 px-5 py-4",
                    !lunas &&
                      "border-l-4 border-l-destructive/60 bg-destructive/5",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{tagihan.muridNama}</p>
                      <p className="text-sm text-muted-foreground">
                        {tagihan.kelasNama}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LabelStatusTagihan status={tagihan.status} />
                      {menunggak(
                        periodeDariTagihan(tagihan),
                        periodeSekarang,
                        tagihan.status,
                      ) && (
                        <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                          Menunggak
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {formatRupiah(tagihan.nominal)}
                      </span>
                      <span>
                        {formatPeriodeTagihan(periodeDariTagihan(tagihan))}
                      </span>
                      {tagihan.tanggalBayar ? (
                        <span>
                          Dibayar{" "}
                          {tanggalTampil.format(
                            new Date(`${tagihan.tanggalBayar}T00:00:00`),
                          )}
                        </span>
                      ) : (
                        <span>Belum dibayar</span>
                      )}
                    </div>
                    {tagihan.sudahDiingatkan && (
                      <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        Sudah diingatkan
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    {lunas ? (
                      batalId === tagihan.id ? (
                        // Pembatalan mengubah data di database, jadi dikonfirmasi
                        // dulu di tempat, sama seperti pola daftar pengeluaran.
                        <div
                          role="alert"
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
                        >
                          <p className="text-sm">
                            Batalkan status lunas {tagihan.muridNama}?
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="aksi"
                              disabled={pending}
                              onClick={() => {
                                setBatalId(null);
                                void ubahStatus(
                                  tagihan,
                                  { status: "belum_lunas" },
                                  `${tagihan.muridNama}: status lunas dibatalkan.`,
                                );
                              }}
                            >
                              <Undo2 aria-hidden="true" />
                              Ya, batalkan
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="aksi"
                              disabled={pending}
                              onClick={() => setBatalId(null)}
                            >
                              Batal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="aksi"
                          disabled={pending}
                          onClick={() => setBatalId(tagihan.id)}
                        >
                          <Undo2 aria-hidden="true" />
                          Batalkan lunas
                        </Button>
                      )
                    ) : bukaId === tagihan.id ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`bayar-${tagihan.id}`}>
                            Tanggal bayar
                          </Label>
                          <Input
                            className="h-[var(--target-sentuh-portal)] md:text-base"
                            id={`bayar-${tagihan.id}`}
                            type="date"
                            value={tanggalBayar}
                            onChange={(event) =>
                              setTanggalBayar(event.target.value)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          size="aksi"
                          disabled={pending}
                          onClick={() => {
                            void ubahStatus(
                              tagihan,
                              { status: "lunas", tanggalBayar },
                              `${tagihan.muridNama}: ditandai lunas (${tanggalBayar}).`,
                            );
                          }}
                        >
                          <Check aria-hidden="true" />
                          Simpan
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="aksi"
                          disabled={pending}
                          onClick={() => setBukaId(null)}
                        >
                          Batal
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="aksi"
                        onClick={() => {
                          setTanggalBayar(tanggalISO(new Date()));
                          setBatalId(null);
                          setBukaId(tagihan.id);
                        }}
                      >
                        <Check aria-hidden="true" />
                        Tandai lunas
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
