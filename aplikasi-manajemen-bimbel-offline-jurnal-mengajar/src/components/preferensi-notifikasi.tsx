"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { JenisNotifikasi } from "@/lib/notifikasi";

/** Satu baris preferensi: jenis pemberitahuan beserta keadaannya untuk akun ini. */
export type BarisPreferensi = {
  jenis: JenisNotifikasi;
  judul: string;
  keterangan: string;
  aktif: boolean;
};

type PreferensiNotifikasiProps = {
  daftarAwal: BarisPreferensi[];
};

/**
 * Preferensi notifikasi per akun: nyalakan atau matikan tiap jenis
 * pemberitahuan. Jenis pemberitahuannya diambil dari daftar baku di
 * `src/lib/notifikasi.ts`, jadi nilainya sama dengan yang dipakai API. Datanya
 * masih tiruan — perubahannya baru berlaku di layar.
 */
export function PreferensiNotifikasi({
  daftarAwal,
}: PreferensiNotifikasiProps) {
  const [daftar, setDaftar] = useState<BarisPreferensi[]>(daftarAwal);
  const [pesan, setPesan] = useState("");

  const jumlahAktif = daftar.filter((item) => item.aktif).length;

  function ubah(baris: BarisPreferensi, aktif: boolean) {
    setDaftar((sebelumnya) =>
      sebelumnya.map((item) =>
        item.jenis === baris.jenis ? { ...item, aktif } : item,
      ),
    );
    setPesan(
      `Pemberitahuan "${baris.judul}" ${
        aktif ? "dinyalakan" : "dimatikan"
      } di layar ini — perubahannya belum dikirim ke server.`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferensi Notifikasi</CardTitle>
        <CardDescription>
          {jumlahAktif} dari {daftar.length} pemberitahuan menyala.
          Notifikasinya muncul di panel pemberitahuan aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          {daftar.map((item) => (
            <li
              key={item.jenis}
              className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
            >
              <Checkbox
                id={`notif-${item.jenis}`}
                checked={item.aktif}
                onCheckedChange={(nilai) => ubah(item, nilai === true)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor={`notif-${item.jenis}`}
                  className="cursor-pointer font-medium"
                >
                  {item.judul}
                </Label>
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.keterangan}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {pesan && (
          <p
            role="status"
            className="inline-flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6"
          >
            <BellRing
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            {pesan}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
