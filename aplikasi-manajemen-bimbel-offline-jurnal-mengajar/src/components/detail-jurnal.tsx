"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarX,
  ArrowLeft,
  CalendarDays,
  Clock,
  LoaderCircle,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DaftarKehadiran } from "@/components/daftar-kehadiran";
import { LabelStatusJurnal } from "@/components/label-status-jurnal";
import { PemilihMateri } from "@/components/pemilih-materi";
import { formatJam } from "@/lib/jurnal";
import {
  koreksiJurnalStub,
  pisahMateri,
  type JurnalRiwayat,
  type MuridJurnal,
} from "@/lib/mock-jurnal";
import { formatTanggalLengkap } from "@/lib/tanggal";

type DetailJurnalProps = {
  jurnal: JurnalRiwayat;
};

/**
 * Halaman detail satu jurnal. Guru bisa membuka kembali catatan yang pernah
 * dikirim dan mengoreksinya (materi, kehadiran, atau catatan tambahan).
 */
export function DetailJurnal({ jurnal }: DetailJurnalProps) {
  const [data, setData] = useState(jurnal);
  const [mode, setMode] = useState<"lihat" | "koreksi">("lihat");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");

  const materiAwal = pisahMateri(jurnal.materi);
  const [pilihan, setPilihan] = useState(materiAwal.pilihan);
  const [topik, setTopik] = useState(materiAwal.topik);
  const [catatan, setCatatan] = useState(jurnal.catatan);
  const [kehadiran, setKehadiran] = useState<Record<string, boolean>>(
    Object.fromEntries(jurnal.murid.map((anak) => [anak.id, anak.hadir])),
  );
  const [keterangan, setKeterangan] = useState<Record<string, string>>(
    Object.fromEntries(jurnal.murid.map((anak) => [anak.id, anak.keterangan])),
  );

  const materiBaru = pilihan
    ? topik.trim()
      ? `${pilihan} — ${topik.trim()}`
      : pilihan
    : topik.trim();
  const materiValid = materiBaru.length > 0;
  const jumlahHadir = data.murid.filter((anak) => anak.hadir).length;

  function mulaiKoreksi() {
    setMode("koreksi");
    setPesan("");
    setError("");
  }

  function batalKoreksi() {
    const awal = pisahMateri(data.materi);
    setPilihan(awal.pilihan);
    setTopik(awal.topik);
    setCatatan(data.catatan);
    setKehadiran(
      Object.fromEntries(data.murid.map((anak) => [anak.id, anak.hadir])),
    );
    setKeterangan(
      Object.fromEntries(data.murid.map((anak) => [anak.id, anak.keterangan])),
    );
    setMode("lihat");
    setError("");
  }

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !materiValid) return;

    const muridBaru: MuridJurnal[] = data.murid.map((anak) => ({
      ...anak,
      hadir: kehadiran[anak.id] ?? anak.hadir,
      keterangan: (keterangan[anak.id] ?? "").trim(),
    }));

    setPending(true);
    setError("");
    try {
      await koreksiJurnalStub({
        materi: materiBaru,
        catatan: catatan.trim(),
        kehadiran: muridBaru.map((anak) => ({
          muridId: anak.id,
          hadir: anak.hadir,
          catatan: anak.keterangan,
        })),
      });
      setData({
        ...data,
        materi: materiBaru,
        catatan: catatan.trim(),
        murid: muridBaru,
      });
      setMode("lihat");
      setPesan("Perubahan jurnal tersimpan.");
    } catch {
      setError("Perubahan gagal disimpan. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-4">
        <Link href="/app/jurnal/riwayat">
          <ArrowLeft aria-hidden="true" />
          Riwayat Jurnal
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Jurnal Ngajar</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {data.namaKelas}
          </h1>
          <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-7 text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatTanggalLengkap(data.tanggal)}
            <span aria-hidden="true">·</span>
            <span>{data.cabang}</span>
          </p>
        </div>
        <LabelStatusJurnal status={data.status} />
      </div>

      {pesan && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm leading-6 text-primary"
        >
          {pesan}
        </p>
      )}

      {mode === "lihat" ? (
        <div className="mt-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
              <CardDescription>
                Catatan yang tersimpan untuk kelas ini.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Jam mengajar</dt>
                  <dd className="font-medium">
                    {data.jamMulai}–{data.jamSelesai} ·{" "}
                    {formatJam(data.jamMengajar)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Murid hadir</dt>
                  <dd className="font-medium">
                    {jumlahHadir} dari {data.murid.length} murid
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Materi</dt>
                  <dd className="font-medium">{data.materi}</dd>
                </div>
                {data.catatan && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Catatan tambahan</dt>
                    <dd className="whitespace-pre-line">{data.catatan}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kehadiran murid</CardTitle>
              <CardDescription>
                {jumlahHadir} dari {data.murid.length} murid hadir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {data.murid.map((anak) => (
                  <li
                    key={anak.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="inline-flex items-center gap-2">
                      {anak.hadir ? (
                        <CalendarCheck
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <CalendarX
                          className="size-4 text-destructive"
                          aria-hidden="true"
                        />
                      )}
                      <Link
                        href={`/app/murid/${anak.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {anak.nama}
                      </Link>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {anak.hadir
                        ? "Hadir"
                        : `Tidak hadir${anak.keterangan ? ` — ${anak.keterangan}` : ""}`}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Button type="button" onClick={mulaiKoreksi}>
            <Pencil aria-hidden="true" />
            Koreksi jurnal
          </Button>
        </div>
      ) : (
        <form
          onSubmit={simpan}
          className="mt-8 space-y-6"
          aria-busy={pending}
          noValidate
        >
          <fieldset disabled={pending} className="space-y-6">
            <legend className="sr-only">Koreksi jurnal</legend>

            <Card>
              <CardHeader>
                <CardTitle>Jam mengajar</CardTitle>
                <CardDescription>
                  {data.jamMulai}–{data.jamSelesai} ·{" "}
                  {formatJam(data.jamMengajar)} — dihitung dari jadwal, dipakai
                  untuk rekap gaji.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" aria-hidden="true" />
                  Hubungi owner kalau jam mengajarnya salah.
                </p>
              </CardContent>
            </Card>

            <DaftarKehadiran
              murid={data.murid}
              kehadiran={kehadiran}
              keterangan={keterangan}
              onHadir={(muridId, hadir) =>
                setKehadiran((sebelumnya) => ({
                  ...sebelumnya,
                  [muridId]: hadir,
                }))
              }
              onKeterangan={(muridId, nilai) =>
                setKeterangan((sebelumnya) => ({
                  ...sebelumnya,
                  [muridId]: nilai,
                }))
              }
              disabled={pending}
            />

            <PemilihMateri
              nilai={pilihan}
              topik={topik}
              onPilih={setPilihan}
              onTopik={setTopik}
              disabled={pending}
              error={
                materiValid
                  ? undefined
                  : "Pilih tombol cepat atau tulis topiknya."
              }
            />

            <Card>
              <CardHeader>
                <CardTitle>Catatan tambahan</CardTitle>
                <CardDescription>
                  Opsional. Misalnya kondisi kelas atau PR untuk pertemuan
                  berikutnya.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label htmlFor="catatan-koreksi" className="sr-only">
                  Catatan tambahan
                </Label>
                <Textarea
                  id="catatan-koreksi"
                  value={catatan}
                  maxLength={1000}
                  disabled={pending}
                  placeholder="Tulis catatan singkat kalau perlu."
                  onChange={(event) => setCatatan(event.target.value)}
                />
              </CardContent>
            </Card>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
              >
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                size="lg"
                disabled={pending || !materiValid}
                aria-busy={pending}
                className="w-full sm:w-auto"
              >
                {pending ? (
                  <LoaderCircle
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Save aria-hidden="true" />
                )}
                {pending ? "Menyimpan…" : "Simpan koreksi"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={pending}
                onClick={batalKoreksi}
                className="w-full sm:w-auto"
              >
                <X aria-hidden="true" />
                Batal
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}
