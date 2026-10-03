"use client";

import { useId, useState, type FormEvent } from "react";
import { CheckCircle2, Save, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatRupiah } from "@/lib/gaji";
import type { AturanGaji } from "@/lib/mock-pengaturan";
import { formatTanggalLengkap, tanggalISO } from "@/lib/tanggal";

const MAX_TARIF = 10_000_000;

type FormAturanGajiProps = {
  riwayatAwal: AturanGaji[];
};

/**
 * Formulir aturan gaji: tarif per jam, skema, dan tanggal mulai berlakunya.
 * Tarifnya masih data tiruan (belum disimpan ke server) — lihat catatan di
 * src/lib/mock-pengaturan.ts.
 */
export function FormAturanGaji({ riwayatAwal }: FormAturanGajiProps) {
  const idForm = useId();
  const [riwayat, setRiwayat] = useState<AturanGaji[]>(riwayatAwal);
  const [tarif, setTarif] = useState(String(riwayatAwal[0]?.tarifPerJam ?? ""));
  const [skema, setSkema] = useState(riwayatAwal[0]?.skema ?? "per jam");
  const [berlakuSejak, setBerlakuSejak] = useState(tanggalISO(new Date()));
  const [galat, setGalat] = useState("");
  const [tersimpan, setTersimpan] = useState(false);

  const berlaku = riwayat[0];

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const angka = Number(tarif);
    if (tarif.trim() === "" || Number.isNaN(angka)) {
      setGalat("Tarif wajib diisi dengan angka.");
      return;
    }
    if (angka <= 0) {
      setGalat("Tarif harus lebih besar dari nol.");
      return;
    }
    if (angka > MAX_TARIF) {
      setGalat(`Tarif terlalu besar. Isi di bawah ${formatRupiah(MAX_TARIF)}.`);
      return;
    }
    if (!berlakuSejak) {
      setGalat("Tanggal berlaku wajib diisi.");
      return;
    }
    if (riwayat.some((baris) => baris.berlakuSejak === berlakuSejak)) {
      setGalat(
        "Sudah ada tarif yang mulai berlaku pada tanggal itu. Pilih tanggal lain.",
      );
      return;
    }

    setGalat("");
    setTersimpan(true);
    setRiwayat((sebelumnya) =>
      [...sebelumnya, { tarifPerJam: angka, skema, berlakuSejak }].sort(
        (a, b) => b.berlakuSejak.localeCompare(a.berlakuSejak),
      ),
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Aturan Gaji &amp; Tarif</CardTitle>
          <CardDescription>
            Rekap gaji dihitung dari jam mengajar dikali tarif yang berlaku pada
            bulan itu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <Wallet aria-hidden="true" className="size-4 text-primary" />
            <span className="font-medium">
              {formatRupiah(berlaku?.tarifPerJam ?? 0)} per jam
            </span>
            <span className="text-muted-foreground">
              ({berlaku?.skema}) mulai{" "}
              {formatTanggalLengkap(berlaku?.berlakuSejak ?? "")}
            </span>
          </p>

          <form onSubmit={simpan} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor={`${idForm}-tarif`}>Tarif per jam</Label>
                <Input
                  id={`${idForm}-tarif`}
                  name="tarif"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  placeholder="mis. 60000"
                  value={tarif}
                  onChange={(event) => setTarif(event.target.value)}
                  aria-invalid={galat.includes("Tarif") || undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idForm}-skema`}>Skema</Label>
                <NativeSelect
                  id={`${idForm}-skema`}
                  name="skema"
                  value={skema}
                  onChange={(event) => setSkema(event.target.value)}
                >
                  <option value="per jam">
                    per jam — dihitung dari jam mengajar
                  </option>
                  <option value="tetap">tetap — dibayar sama tiap bulan</option>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idForm}-berlaku`}>Berlaku sejak</Label>
                <Input
                  id={`${idForm}-berlaku`}
                  name="berlakuSejak"
                  type="date"
                  value={berlakuSejak}
                  onChange={(event) => setBerlakuSejak(event.target.value)}
                  aria-invalid={
                    galat.includes("Tanggal") || galat.includes("berlaku")
                      ? true
                      : undefined
                  }
                />
              </div>
            </div>

            {galat && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
              >
                {galat}
              </p>
            )}

            <Button type="submit">
              <Save aria-hidden="true" />
              Simpan tarif
            </Button>
          </form>

          {tersimpan && (
            <p
              role="status"
              className="mt-5 inline-flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6"
            >
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              Tarif baru masuk ke riwayat di bawah. Perubahannya belum dikirim
              ke server — halaman ini masih memakai data tiruan.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat tarif</CardTitle>
          <CardDescription>
            Yang terbaru berlaku untuk jurnal-jurnal setelah tanggalnya; bulan
            lama tetap memakai tarif saat itu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {riwayat.map((baris, urutan) => (
              <li
                key={`${baris.berlakuSejak}-${baris.tarifPerJam}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-3"
              >
                <span className="text-sm">
                  <span className="font-medium">
                    {formatRupiah(baris.tarifPerJam)}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    per jam · {baris.skema} · mulai{" "}
                    {formatTanggalLengkap(baris.berlakuSejak)}
                  </span>
                </span>
                {urutan === 0 && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    Berlaku sekarang
                  </span>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
