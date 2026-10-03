"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Clock, Send, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatJam } from "@/lib/mock-jurnal";

export type MuridTerkirim = {
  nama: string;
  hadir: boolean;
  keterangan: string;
};

export type RingkasanJurnal = {
  namaKelas: string;
  cabang: string;
  jamMulai: string;
  jamSelesai: string;
  jamMengajar: number;
  tanggalTampil: string;
  materi: string;
  catatan: string;
  waktuKirim: string;
  murid: MuridTerkirim[];
};

type KonfirmasiJurnalProps = {
  ringkasan: RingkasanJurnal;
  onIsiLain: () => void;
};

/**
 * Konfirmasi setelah jurnal dikirim: menunjukkan apa yang tercatat, jam
 * mengajar yang ikut terhitung untuk gaji, dan siapa saja yang tidak hadir.
 */
export function KonfirmasiJurnal({
  ringkasan,
  onIsiLain,
}: KonfirmasiJurnalProps) {
  const kartuRef = useRef<HTMLDivElement>(null);

  // Fokus pindah ke konfirmasi supaya pembaca layar dan keyboard ikut tahu
  // bahwa form sudah tergantikan.
  useEffect(() => {
    kartuRef.current?.focus();
  }, []);

  const jumlahHadir = ringkasan.murid.filter((anak) => anak.hadir).length;
  const tidakHadir = ringkasan.murid.filter((anak) => !anak.hadir);

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        ref={kartuRef}
        tabIndex={-1}
        role="status"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="outline-none"
      >
        <Card className="border-primary/30">
          <CardHeader>
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <CardTitle className="text-xl">Jurnal terkirim ke owner</CardTitle>
            <CardDescription>
              Laporan {ringkasan.namaKelas} untuk {ringkasan.tanggalTampil}{" "}
              sudah tercatat. Owner bisa langsung membacanya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-3 rounded-xl bg-muted px-4 py-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Kelas</dt>
                <dd className="font-medium">
                  {ringkasan.namaKelas} · {ringkasan.cabang}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Jam mengajar</dt>
                <dd className="font-medium">
                  {ringkasan.jamMulai}–{ringkasan.jamSelesai} (
                  {formatJam(ringkasan.jamMengajar)})
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Materi</dt>
                <dd className="font-medium">{ringkasan.materi}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Murid hadir</dt>
                <dd className="font-medium">
                  {jumlahHadir} dari {ringkasan.murid.length} murid
                </dd>
              </div>
            </dl>

            {tidakHadir.length > 0 && (
              <div className="rounded-xl border px-4 py-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <UserX
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Tidak hadir
                </p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {tidakHadir.map((anak) => (
                    <li key={anak.nama}>
                      {anak.nama}
                      {anak.keterangan ? ` — ${anak.keterangan}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ringkasan.catatan && (
              <div className="rounded-xl border px-4 py-3 text-sm">
                <p className="font-medium">Catatan tambahan</p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">
                  {ringkasan.catatan}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden="true" />
                Dikirim pukul {ringkasan.waktuKirim}
              </p>
              <Button type="button" onClick={onIsiLain}>
                <Send aria-hidden="true" />
                Isi jurnal kelas lain
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
