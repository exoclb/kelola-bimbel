"use client";

import { useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Pencil,
  Plus,
  UserRound,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormCatatanAnak,
  type IsiCatatan,
} from "@/components/form-catatan-anak";
import type { Murid } from "@/lib/mock-murid";
import type { CatatanPerkembangan } from "@/lib/mock-perkembangan";
import { formatTanggalLengkap } from "@/lib/tanggal";

type DaftarPerkembanganProps = {
  daftarMurid: Murid[];
  catatanAwal: CatatanPerkembangan[];
  namaGuru: string;
};

function labelNilai(nilai: number) {
  if (nilai >= 85) return "border-primary/30 bg-primary/10 text-primary";
  if (nilai >= 70) return "border-input bg-muted text-foreground";
  return "border-destructive/30 bg-destructive/5 text-destructive";
}

/**
 * Perkembangan tiap anak: catatan terbaru dari guru — nilai, sikap, dan
 * catatannya — beserta berapa banyak catatan yang sudah terkumpul. Catatan
 * baru ditambahkan dan catatan terbaru bisa diubah dari kartu yang sama.
 */
export function DaftarPerkembangan({
  daftarMurid,
  catatanAwal,
  namaGuru,
}: DaftarPerkembanganProps) {
  const [catatan, setCatatan] = useState(catatanAwal);
  const [pesan, setPesan] = useState("");
  const [formUntuk, setFormUntuk] = useState<
    { muridId: string; catatanId?: string } | undefined
  >();

  function catatanMurid(muridId: string) {
    return catatan
      .filter((baris) => baris.muridId === muridId)
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  }

  const muridDenganCatatan = daftarMurid.filter(
    (murid) => catatanMurid(murid.id).length > 0,
  );

  function simpanCatatan(murid: Murid, isi: IsiCatatan) {
    if (formUntuk?.catatanId) {
      setCatatan((sebelumnya) =>
        sebelumnya.map((baris) =>
          baris.id === formUntuk.catatanId ? { ...baris, ...isi } : baris,
        ),
      );
      setPesan(`Catatan ${murid.nama} diperbarui.`);
    } else {
      setCatatan((sebelumnya) => [
        {
          id: crypto.randomUUID(),
          muridId: murid.id,
          guruNama: namaGuru,
          ...isi,
        },
        ...sebelumnya,
      ]);
      setPesan(`Catatan baru untuk ${murid.nama} tersimpan.`);
    }
    setFormUntuk(undefined);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Perkembangan Anak</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Perkembangan Anak
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {muridDenganCatatan.length === 0
          ? "Belum ada catatan perkembangan."
          : `${muridDenganCatatan.length} dari ${daftarMurid.length} murid punya catatan · ${catatan.length} catatan terkumpul.`}
      </p>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
      </p>

      {muridDenganCatatan.length === 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Belum ada catatan</CardTitle>
            <CardDescription>
              Catatan nilai dan sikap anak muncul di sini setelah guru
              mengisinya.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {muridDenganCatatan.map((murid) => {
            const riwayat = catatanMurid(murid.id);
            const terbaru = riwayat[0];
            const formIni = formUntuk?.muridId === murid.id;
            const catatanDiubah =
              formIni && formUntuk?.catatanId
                ? riwayat.find((baris) => baris.id === formUntuk.catatanId)
                : undefined;

            return (
              <li key={murid.id}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{murid.nama}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {formatTanggalLengkap(terbaru.tanggal)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="size-4" aria-hidden="true" />
                          {terbaru.guruNama}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <ClipboardList
                            className="size-4"
                            aria-hidden="true"
                          />
                          {riwayat.length} catatan
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                          labelNilai(terbaru.nilai),
                        )}
                      >
                        <GraduationCap
                          className="size-3.5"
                          aria-hidden="true"
                        />
                        Nilai {terbaru.nilai}
                      </span>
                      <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
                        {terbaru.sikap}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm">
                    {terbaru.catatanPerkembangan || (
                      <span className="text-muted-foreground">
                        Tanpa catatan tertulis.
                      </span>
                    )}
                  </p>

                  {formIni ? (
                    <FormCatatanAnak
                      namaMurid={murid.nama}
                      catatanAwal={catatanDiubah}
                      onSimpan={(isi) => simpanCatatan(murid, isi)}
                      onBatal={() => setFormUntuk(undefined)}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setFormUntuk({ muridId: murid.id })}
                      >
                        <Plus aria-hidden="true" />
                        Tambah catatan
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormUntuk({
                            muridId: murid.id,
                            catatanId: terbaru.id,
                          })
                        }
                      >
                        <Pencil aria-hidden="true" />
                        Ubah catatan terbaru
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: catatan perkembangan belum tersimpan di database —
        penyimpanannya menyusul bersama API-nya.
      </p>
    </div>
  );
}
