"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, History, LoaderCircle, Send } from "lucide-react";
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
import {
  KonfirmasiJurnal,
  type RingkasanJurnal,
} from "@/components/konfirmasi-jurnal";
import { PemilihJadwal } from "@/components/pemilih-jadwal";
import { PemilihMateri } from "@/components/pemilih-materi";
import { formatJam, hitungJamMengajar } from "@/lib/jurnal";
import {
  kirimJurnalStub,
  type Jadwal,
  type JurnalInput,
} from "@/lib/mock-jurnal";

type JurnalFormProps = {
  jadwal: Jadwal[];
  hari: string;
  namaGuru: string;
  tanggalTampil: string;
};

export function JurnalForm({
  jadwal,
  hari,
  namaGuru,
  tanggalTampil,
}: JurnalFormProps) {
  const [jadwalId, setJadwalId] = useState("");
  const [kehadiran, setKehadiran] = useState<Record<string, boolean>>({});
  const [keterangan, setKeterangan] = useState<Record<string, string>>({});
  const [materi, setMateri] = useState("");
  const [topik, setTopik] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorJadwal, setErrorJadwal] = useState("");
  const [errorMateri, setErrorMateri] = useState("");
  const [terkirim, setTerkirim] = useState<RingkasanJurnal | null>(null);

  const jadwalTerpilih = jadwal.find((item) => item.id === jadwalId);

  // Tombol kirim hanya aktif setelah data wajib lengkap, jadi guru tidak
  // pernah menekan tombol yang berakhir dengan error.
  const bagianKurang = [
    jadwalTerpilih ? null : "kelas & jam mengajar",
    materi ? null : "jenis materi",
  ].filter((bagian): bagian is string => bagian !== null);
  const siapKirim = bagianKurang.length === 0;

  function pilihJadwal(item: Jadwal) {
    setJadwalId(item.id);
    setErrorJadwal("");
    setKehadiran(
      Object.fromEntries(item.murid.map((murid) => [murid.id, true])),
    );
    setKeterangan({});
  }

  function ubahKehadiran(muridId: string, hadir: boolean) {
    setKehadiran((sebelumnya) => ({ ...sebelumnya, [muridId]: hadir }));
  }

  function ubahKeterangan(muridId: string, nilai: string) {
    setKeterangan((sebelumnya) => ({ ...sebelumnya, [muridId]: nilai }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const masalahJadwal = jadwalTerpilih
      ? ""
      : "Pilih kelas dan jam mengajar dulu.";
    const masalahMateri = materi ? "" : "Pilih jenis materi yang diajarkan.";
    setErrorJadwal(masalahJadwal);
    setErrorMateri(masalahMateri);
    setError("");
    if (masalahJadwal || masalahMateri || !jadwalTerpilih) return;

    const materiLengkap = topik.trim() ? `${materi} — ${topik.trim()}` : materi;
    const jurnal: JurnalInput = {
      jadwalId: jadwalTerpilih.id,
      materi: materiLengkap,
      catatan: catatan.trim(),
      kehadiran: jadwalTerpilih.murid.map((murid) => ({
        muridId: murid.id,
        hadir: kehadiran[murid.id] ?? false,
        catatan: (keterangan[murid.id] ?? "").trim(),
      })),
    };

    setPending(true);
    try {
      await kirimJurnalStub(jurnal);
      setTerkirim({
        namaKelas: jadwalTerpilih.namaKelas,
        cabang: jadwalTerpilih.cabang,
        jamMulai: jadwalTerpilih.jamMulai,
        jamSelesai: jadwalTerpilih.jamSelesai,
        jamMengajar: hitungJamMengajar(
          jadwalTerpilih.jamMulai,
          jadwalTerpilih.jamSelesai,
        ),
        tanggalTampil,
        materi: materiLengkap,
        catatan: jurnal.catatan,
        waktuKirim: new Intl.DateTimeFormat("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date()),
        murid: jadwalTerpilih.murid.map((murid) => ({
          nama: murid.nama,
          hadir: kehadiran[murid.id] ?? false,
          keterangan: (keterangan[murid.id] ?? "").trim(),
        })),
      });
    } catch {
      setError("Jurnal gagal dikirim. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  function isiJurnalLain() {
    setJadwalId("");
    setKehadiran({});
    setKeterangan({});
    setMateri("");
    setTopik("");
    setCatatan("");
    setError("");
    setErrorJadwal("");
    setErrorMateri("");
    setTerkirim(null);
  }

  if (terkirim) {
    return <KonfirmasiJurnal ringkasan={terkirim} onIsiLain={isiJurnalLain} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Jurnal Ngajar</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Isi Jurnal Hari Ini
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-7 text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          {tanggalTampil}
          <span aria-hidden="true">·</span>
          <span>Guru: {namaGuru}</span>
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/jurnal/riwayat">
            <History aria-hidden="true" />
            Riwayat Jurnal
          </Link>
        </Button>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-6"
        aria-busy={pending}
        noValidate
      >
        <fieldset disabled={pending} className="space-y-6">
          <legend className="sr-only">Formulir jurnal mengajar</legend>

          <PemilihJadwal
            jadwal={jadwal}
            hari={hari}
            nilai={jadwalId}
            onPilih={pilihJadwal}
            disabled={pending}
            error={errorJadwal}
          />

          {jadwal.length > 0 && (
            <>
              {jadwalTerpilih ? (
                <DaftarKehadiran
                  murid={jadwalTerpilih.murid}
                  kehadiran={kehadiran}
                  keterangan={keterangan}
                  onHadir={ubahKehadiran}
                  onKeterangan={ubahKeterangan}
                  disabled={pending}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Kehadiran murid</CardTitle>
                    <CardDescription>
                      Pilih kelas dulu untuk melihat daftar murid.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              <PemilihMateri
                nilai={materi}
                topik={topik}
                onPilih={(pilihan) => {
                  setMateri(pilihan);
                  setErrorMateri("");
                }}
                onTopik={setTopik}
                disabled={pending}
                error={errorMateri}
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
                  <Label htmlFor="catatan" className="sr-only">
                    Catatan tambahan
                  </Label>
                  <Textarea
                    id="catatan"
                    value={catatan}
                    maxLength={1000}
                    disabled={pending}
                    placeholder="Tulis catatan singkat kalau perlu."
                    onChange={(event) => setCatatan(event.target.value)}
                  />
                </CardContent>
              </Card>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p
                  aria-live="polite"
                  className="text-sm leading-6 text-muted-foreground"
                >
                  {!siapKirim
                    ? `Tinggal lengkapi: ${bagianKurang.join(" dan ")}.`
                    : jadwalTerpilih
                      ? `Jam mengajar yang dicatat: ${formatJam(
                          hitungJamMengajar(
                            jadwalTerpilih.jamMulai,
                            jadwalTerpilih.jamSelesai,
                          ),
                        )} — dipakai untuk rekap gaji.`
                      : "Jam mengajar dihitung otomatis dari jadwal."}
                </p>
                <Button
                  type="submit"
                  size="lg"
                  disabled={pending || !siapKirim}
                  aria-busy={pending}
                  className="w-full sm:w-auto"
                >
                  {pending ? (
                    <LoaderCircle
                      className="animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  {pending ? "Mengirim…" : "Kirim Jurnal"}
                </Button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
                >
                  {error}
                </p>
              )}
            </>
          )}
        </fieldset>
      </form>
    </div>
  );
}
