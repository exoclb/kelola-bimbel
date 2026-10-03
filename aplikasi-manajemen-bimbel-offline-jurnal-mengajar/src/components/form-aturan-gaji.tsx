"use client";

import { useId, useState, type FormEvent } from "react";
import { AlertTriangle, Save, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KonfirmasiPengaturan } from "@/components/konfirmasi-pengaturan";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatRupiah } from "@/lib/gaji";
import type { AturanGaji } from "@/lib/mock-pengaturan";
import { formatTanggalLengkap, tanggalISO } from "@/lib/tanggal";

const MAX_TARIF = 10_000_000;

type Masalah = { field: string; pesan: string };

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
  const [masalah, setMasalah] = useState<Masalah[]>([]);
  const [tersimpan, setTersimpan] = useState<AturanGaji | null>(null);

  const berlaku = tersimpan ?? riwayat[0];

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Semua isian yang bermasalah ditampilkan sekaligus.
    const ditemukan: Masalah[] = [];
    const angka = Number(tarif);
    if (tarif.trim() === "" || Number.isNaN(angka))
      ditemukan.push({
        field: "tarif",
        pesan: "Tarif wajib diisi dengan angka.",
      });
    else if (angka <= 0)
      ditemukan.push({
        field: "tarif",
        pesan: "Tarif harus lebih besar dari nol.",
      });
    else if (angka > MAX_TARIF)
      ditemukan.push({
        field: "tarif",
        pesan: `Tarif terlalu besar. Isi di bawah ${formatRupiah(MAX_TARIF)}.`,
      });

    if (!berlakuSejak)
      ditemukan.push({
        field: "berlakuSejak",
        pesan: "Tanggal berlaku wajib diisi.",
      });
    else if (riwayat.some((baris) => baris.berlakuSejak === berlakuSejak))
      ditemukan.push({
        field: "berlakuSejak",
        pesan:
          "Sudah ada tarif yang mulai berlaku pada tanggal itu. Pilih tanggal lain.",
      });

    if (ditemukan.length > 0) {
      setMasalah(ditemukan);
      setTersimpan(null);
      return;
    }

    const baru: AturanGaji = { tarifPerJam: angka, skema, berlakuSejak };
    setMasalah([]);
    setTersimpan(baru);
    setRiwayat((sebelumnya) =>
      [...sebelumnya, baru].sort((a, b) =>
        b.berlakuSejak.localeCompare(a.berlakuSejak),
      ),
    );
  }

  const salah = (field: string) =>
    masalah.some((item) => item.field === field) || undefined;

  return (
    <div className="space-y-6">
      {tersimpan ? (
        <KonfirmasiPengaturan
          judul="Tarif baru tersimpan"
          keterangan="Tarif ini yang dipakai menghitung gaji jurnal setelah tanggal berlakunya."
          baris={[
            {
              label: "Tarif per jam",
              nilai: formatRupiah(tersimpan.tarifPerJam),
            },
            { label: "Skema", nilai: tersimpan.skema },
            {
              label: "Berlaku sejak",
              nilai: formatTanggalLengkap(tersimpan.berlakuSejak),
            },
          ]}
          catatan="Perubahannya belum dikirim ke server — halaman ini masih memakai data tiruan."
          onUbahLagi={() => setTersimpan(null)}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Aturan Gaji &amp; Tarif</CardTitle>
            <CardDescription>
              Rekap gaji dihitung dari jam mengajar dikali tarif yang berlaku
              pada bulan itu.
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
                    aria-invalid={salah("tarif")}
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
                    <option value="tetap">
                      tetap — dibayar sama tiap bulan
                    </option>
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
                    aria-invalid={salah("berlakuSejak")}
                  />
                </div>
              </div>

              {masalah.length > 0 && (
                <div
                  role="alert"
                  className="space-y-1 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <AlertTriangle aria-hidden="true" className="size-4" />
                    Masih ada isian yang perlu diperbaiki
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {masalah.map((item) => (
                      <li key={item.field}>{item.pesan}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button type="submit">
                <Save aria-hidden="true" />
                Simpan tarif
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

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
