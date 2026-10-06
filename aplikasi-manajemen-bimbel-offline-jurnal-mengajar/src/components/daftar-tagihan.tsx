"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BellRing, CalendarPlus, Check, PiggyBank, Undo2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { LabelStatusTagihan } from "@/components/label-status-tagihan";
import { PesanKosong } from "@/components/status-antarmuka";
import { formatRupiah } from "@/lib/gaji";
import {
  formatPeriodeTagihan,
  hitungRekapTagihan,
  periodeDariTagihan,
  type Tagihan,
} from "@/lib/tagihan";
import { tanggalISO } from "@/lib/tanggal";

type DaftarTagihanProps = {
  daftar: Tagihan[];
  periode: string;
  periodeTampil: string;
  muridSudahDitagih: string[];
};

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
export function DaftarTagihan({ daftar, periodeTampil }: DaftarTagihanProps) {
  const router = useRouter();

  // Tagihan yang sedang ditandai lunas, dan tanggal bayar yang diisi owner.
  const [bukaId, setBukaId] = useState<string | null>(null);
  const [tanggalBayar, setTanggalBayar] = useState(tanggalISO(new Date()));
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const rekap = hitungRekapTagihan(daftar);

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
          <Button asChild variant="outline" size="sm">
            <Link href="/app/tagihan/pengingat">
              <BellRing aria-hidden="true" />
              Menunggak
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/app/tagihan/rekap">
              <PiggyBank aria-hidden="true" />
              Rekap pemasukan
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app/tagihan/baru">
              <CalendarPlus aria-hidden="true" />
              Buat tagihan
            </Link>
          </Button>
        </div>
      </div>

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

      {daftar.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul="Belum ada tagihan bulan ini"
          keterangan="Tekan Buat tagihan untuk menerbitkan tagihan periode ini."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((tagihan) => {
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
                    <LabelStatusTagihan status={tagihan.status} />
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          void ubahStatus(
                            tagihan,
                            { status: "belum_lunas" },
                            `${tagihan.muridNama}: status lunas dibatalkan.`,
                          );
                        }}
                      >
                        <Undo2 aria-hidden="true" />
                        Batalkan lunas
                      </Button>
                    ) : bukaId === tagihan.id ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor={`bayar-${tagihan.id}`}>
                            Tanggal bayar
                          </Label>
                          <Input
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
                          size="sm"
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
                          size="sm"
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
                        size="sm"
                        onClick={() => {
                          setTanggalBayar(tanggalISO(new Date()));
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
