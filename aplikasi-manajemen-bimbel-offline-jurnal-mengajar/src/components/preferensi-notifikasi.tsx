"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, LoaderCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PesanGalat } from "@/components/status-antarmuka";
import type { JenisNotifikasi } from "@/lib/notifikasi";
import { pesanGalatApi } from "@/lib/pesan-api";

/** Satu baris preferensi: jenis pemberitahuan beserta keadaannya untuk akun ini. */
export type BarisPreferensi = {
  jenis: JenisNotifikasi;
  judul: string;
  keterangan: string;
  aktif: boolean;
};

type PreferensiNotifikasiProps = {
  /**
   * Keadaan tersimpan akun ini, hasil `ambilPreferensiNotifikasi()` — jenis yang
   * belum pernah diubah memakai bawaan jenisnya.
   */
  daftarAwal: BarisPreferensi[];
};

/**
 * Preferensi notifikasi per akun: nyalakan atau matikan tiap jenis
 * pemberitahuan. Jenis pemberitahuannya diambil dari daftar baku di
 * `src/lib/notifikasi.ts`, jadi nilainya sama dengan yang dipakai API.
 *
 * Perubahan dikirim ke `PATCH /api/pengaturan/notifikasi`; jawabannya adalah
 * daftar terbaru, jadi yang ditampilkan selalu keadaan yang benar-benar
 * tersimpan. Kalau server menolak, layarnya dikembalikan ke keadaan sebelumnya.
 */
export function PreferensiNotifikasi({
  daftarAwal,
}: PreferensiNotifikasiProps) {
  const router = useRouter();
  const [daftar, setDaftar] = useState<BarisPreferensi[]>(daftarAwal);
  const [sedangSimpan, setSedangSimpan] = useState<JenisNotifikasi | null>(
    null,
  );
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");

  const jumlahAktif = daftar.filter((item) => item.aktif).length;
  // Selama satu perubahan masih di jalan, saklar lain dikunci dulu supaya
  // jawaban server tidak saling menimpa.
  const sibuk = sedangSimpan !== null;

  async function ubah(baris: BarisPreferensi, aktif: boolean) {
    const sebelum = daftar;
    setPesan("");
    setGalat("");
    setSedangSimpan(baris.jenis);
    // Perubahan langsung terlihat, lalu dikembalikan kalau server menolaknya.
    setDaftar((sebelumnya) =>
      sebelumnya.map((item) =>
        item.jenis === baris.jenis ? { ...item, aktif } : item,
      ),
    );

    try {
      const jawaban = await fetch("/api/pengaturan/notifikasi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenis: baris.jenis, aktif }),
      });
      if (!jawaban.ok) {
        throw new Error(
          await pesanGalatApi(jawaban, "Preferensinya belum bisa disimpan."),
        );
      }
      const isi = (await jawaban.json()) as { data: BarisPreferensi[] };
      setDaftar(isi.data);
      setPesan(
        `Pemberitahuan "${baris.judul}" ${aktif ? "dinyalakan" : "dimatikan"}.`,
      );
      // Ringkasan di halaman lain (kartu Pengaturan) ikut membaca basis data.
      router.refresh();
    } catch (penyebab) {
      setDaftar(sebelum);
      setGalat(
        penyebab instanceof Error
          ? penyebab.message
          : "Preferensinya belum bisa disimpan. Coba lagi sebentar lagi.",
      );
    } finally {
      setSedangSimpan(null);
    }
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
                disabled={sibuk}
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

        {sedangSimpan && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Menyimpan pilihannya…
          </p>
        )}

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

        {galat && <PesanGalat keterangan={galat} />}
      </CardContent>
    </Card>
  );
}
