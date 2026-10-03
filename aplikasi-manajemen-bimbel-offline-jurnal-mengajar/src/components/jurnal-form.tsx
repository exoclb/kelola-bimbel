"use client";

import { useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  Send,
  Users,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PILIHAN_MATERI,
  formatJam,
  hitungJamMengajar,
  kirimJurnalStub,
  type JadwalHariIni,
  type JurnalInput,
} from "@/lib/mock-jurnal";

type JurnalFormProps = {
  jadwal: JadwalHariIni[];
  namaGuru: string;
  tanggal: string;
  tanggalTampil: string;
};

export function JurnalForm({
  jadwal,
  namaGuru,
  tanggal,
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
  const [terkirim, setTerkirim] = useState<JurnalInput | null>(null);

  const jadwalTerpilih = jadwal.find((item) => item.id === jadwalId);

  function pilihJadwal(id: string) {
    setJadwalId(id);
    setErrorJadwal("");
    const dipilih = jadwal.find((item) => item.id === id);
    setKehadiran(
      Object.fromEntries((dipilih?.murid ?? []).map((murid) => [murid.id, true])),
    );
    setKeterangan({});
  }

  function ubahKehadiran(muridId: string, hadir: boolean) {
    setKehadiran((sebelumnya) => ({ ...sebelumnya, [muridId]: hadir }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const masalahJadwal = jadwalTerpilih ? "" : "Pilih kelas dan jam mengajar dulu.";
    const masalahMateri = materi ? "" : "Pilih jenis materi yang diajarkan.";
    setErrorJadwal(masalahJadwal);
    setErrorMateri(masalahMateri);
    setError("");
    if (masalahJadwal || masalahMateri || !jadwalTerpilih) return;

    const materiLengkap = topik.trim() ? `${materi} — ${topik.trim()}` : materi;
    const jurnal: JurnalInput = {
      jadwalId: jadwalTerpilih.id,
      kelasId: jadwalTerpilih.kelasId,
      tanggal,
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
      setTerkirim(jurnal);
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
    const jumlahHadir = terkirim.kehadiran.filter((baris) => baris.hadir).length;
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="border-primary/30">
          <CardHeader>
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <CardTitle className="text-xl">Jurnal terkirim ke owner</CardTitle>
            <CardDescription>
              Laporan {jadwalTerpilih?.namaKelas ?? "kelas"} untuk {tanggalTampil}{" "}
              sudah tercatat. Owner bisa langsung membacanya.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 rounded-xl bg-muted px-4 py-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Kelas</dt>
                <dd className="font-medium">{jadwalTerpilih?.namaKelas}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Jam mengajar</dt>
                <dd className="font-medium">
                  {jadwalTerpilih
                    ? formatJam(
                        hitungJamMengajar(
                          jadwalTerpilih.jamMulai,
                          jadwalTerpilih.jamSelesai,
                        ),
                      )
                    : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Materi</dt>
                <dd className="font-medium">{terkirim.materi}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Murid hadir</dt>
                <dd className="font-medium">
                  {jumlahHadir} dari {terkirim.kehadiran.length} murid
                </dd>
              </div>
            </dl>
            <Button type="button" onClick={isiJurnalLain}>
              <Send aria-hidden="true" />
              Isi jurnal kelas lain
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Jurnal Ngajar</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Isi Jurnal Hari Ini
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-7 text-muted-foreground">
        <CalendarDays className="size-4" aria-hidden="true" />
        {tanggalTampil}
        <span aria-hidden="true">·</span>
        <span>Guru: {namaGuru}</span>
      </p>

      {jadwal.length === 0 ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Tidak ada jadwal hari ini</CardTitle>
            <CardDescription>
              Besok jadwalmu akan muncul di sini lagi.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-6"
          aria-busy={pending}
          noValidate
        >
          <fieldset disabled={pending} className="space-y-6">
            <legend className="sr-only">Formulir jurnal mengajar</legend>

            <Card>
              <CardHeader>
                <CardTitle>1. Pilih kelas &amp; jam mengajar</CardTitle>
                <CardDescription>
                  Pilih satu kelas dari jadwalmu hari ini.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="space-y-3"
                  aria-describedby={errorJadwal ? "jadwal-error" : undefined}
                >
                  {jadwal.map((item) => {
                    const terpilih = item.id === jadwalId;
                    return (
                      <label
                        key={item.id}
                        htmlFor={`jadwal-${item.id}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
                          "hover:bg-accent/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                          terpilih && "border-primary bg-primary/5",
                        )}
                      >
                        <input
                          id={`jadwal-${item.id}`}
                          type="radio"
                          name="jadwal"
                          value={item.id}
                          checked={terpilih}
                          onChange={() => pilihJadwal(item.id)}
                          className="mt-1 size-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 space-y-1">
                          <span className="block font-medium">
                            {item.namaKelas}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span>
                              {item.jamMulai}–{item.jamSelesai}
                            </span>
                            <span>
                              {formatJam(
                                hitungJamMengajar(item.jamMulai, item.jamSelesai),
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3.5" aria-hidden="true" />
                              {item.murid.length} murid
                            </span>
                            <span>{item.cabang}</span>
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {errorJadwal && (
                  <p
                    id="jadwal-error"
                    role="alert"
                    className="mt-3 text-sm text-destructive"
                  >
                    {errorJadwal}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Kehadiran murid</CardTitle>
                <CardDescription>
                  {jadwalTerpilih
                    ? "Semua murid dianggap hadir. Hilangkan centang kalau ada yang tidak masuk."
                    : "Pilih kelas dulu untuk melihat daftar murid."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!jadwalTerpilih ? (
                  <p className="text-sm text-muted-foreground">
                    Belum ada kelas yang dipilih.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {jadwalTerpilih.murid.map((murid) => {
                      const hadir = kehadiran[murid.id] ?? false;
                      return (
                        <li
                          key={murid.id}
                          className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`hadir-${murid.id}`}
                              checked={hadir}
                              disabled={pending}
                              onCheckedChange={(nilai) =>
                                ubahKehadiran(murid.id, nilai === true)
                              }
                            />
                            <Label
                              htmlFor={`hadir-${murid.id}`}
                              className="cursor-pointer font-normal"
                            >
                              {murid.nama}
                            </Label>
                          </div>
                          {hadir ? (
                            <span className="pl-7 text-sm text-muted-foreground sm:pl-0">
                              Hadir
                            </span>
                          ) : (
                            <div className="pl-7 sm:pl-0 sm:w-64">
                              <Label
                                htmlFor={`keterangan-${murid.id}`}
                                className="sr-only"
                              >
                                Keterangan {murid.nama}
                              </Label>
                              <Input
                                id={`keterangan-${murid.id}`}
                                value={keterangan[murid.id] ?? ""}
                                maxLength={200}
                                disabled={pending}
                                placeholder="Keterangan (opsional)"
                                onChange={(event) =>
                                  setKeterangan((sebelumnya) => ({
                                    ...sebelumnya,
                                    [murid.id]: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Materi &amp; catatan</CardTitle>
                <CardDescription>
                  Pilih lewat tombol cepat, tidak perlu menulis panjang.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div
                  role="group"
                  aria-label="Pilihan cepat jenis materi"
                  className="flex flex-wrap gap-2"
                  aria-describedby={errorMateri ? "materi-error" : undefined}
                >
                  {PILIHAN_MATERI.map((pilihan) => {
                    const terpilih = pilihan === materi;
                    return (
                      <Button
                        key={pilihan}
                        type="button"
                        size="sm"
                        variant={terpilih ? "default" : "outline"}
                        aria-pressed={terpilih}
                        disabled={pending}
                        onClick={() => {
                          setMateri(pilihan);
                          setErrorMateri("");
                        }}
                      >
                        {pilihan}
                      </Button>
                    );
                  })}
                </div>
                {errorMateri && (
                  <p id="materi-error" role="alert" className="text-sm text-destructive">
                    {errorMateri}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="topik">Topik spesifik (opsional)</Label>
                  <Input
                    id="topik"
                    value={topik}
                    maxLength={120}
                    disabled={pending}
                    placeholder="Misalnya: pecahan campuran"
                    onChange={(event) => setTopik(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="catatan">Catatan tambahan (opsional)</Label>
                  <Textarea
                    id="catatan"
                    value={catatan}
                    maxLength={1000}
                    disabled={pending}
                    placeholder="Misalnya: dua murid perlu diulang materinya minggu depan."
                    onChange={(event) => setCatatan(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </fieldset>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {jadwalTerpilih
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
              disabled={pending}
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
        </form>
      )}
    </div>
  );
}
