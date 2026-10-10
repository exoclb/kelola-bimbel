"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCheck,
  CircleDashed,
  History,
  Info,
  LoaderCircle,
  Send,
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
import {
  KonfirmasiJurnal,
  type RingkasanJurnal,
} from "@/components/konfirmasi-jurnal";
import { PemilihJadwal } from "@/components/pemilih-jadwal";
import { PemilihMateri } from "@/components/pemilih-materi";
import { StatusSesiJurnal } from "@/components/status-sesi-jurnal";
import {
  catatanDariPresensi,
  hitungJamMengajar,
  statusSimpanJurnal,
  type IsianJurnal,
  type Jadwal,
  type JurnalInput,
  type JurnalTersimpanHari,
  type StatusPresensiMurid,
  type StatusSimpanJurnal,
} from "@/lib/jurnal";
import { pesanGalatApi } from "@/lib/pesan-api";
import { useMenitPerangkat } from "@/lib/tanggal-perangkat";

type JurnalFormProps = {
  jadwal: Jadwal[];
  /** Jurnal yang sudah diisi hari ini, dikunci per id jadwal. */
  sudahDiisi?: Record<string, JurnalTersimpanHari>;
  hari: string;
  namaGuru: string;
  tanggalTampil: string;
  /** Menit sejak tengah malam menurut jam server, dasar pil keadaan sesi. */
  menitServer: number;
};

/** Kalimat penanda status simpan yang tampil di dekat tombol kirim. */
function pesanStatusSimpan(
  status: StatusSimpanJurnal,
  tersimpan: JurnalTersimpanHari | undefined,
) {
  if (status === "tersimpan" && tersimpan)
    return `Tersimpan ${tersimpan.waktuSimpan} — semua isian sudah dikirim.`;
  if (status === "belum-dikirim") return "Ada isian yang belum dikirim.";
  return "Belum ada yang tersimpan untuk sesi ini.";
}

export function JurnalForm({
  jadwal,
  sudahDiisi = {},
  hari,
  namaGuru,
  tanggalTampil,
  menitServer,
}: JurnalFormProps) {
  const router = useRouter();
  // Jam guru sendiri yang dipakai untuk keadaan sesi, bukan jam server, supaya
  // zona waktu wadah produksi tidak menggeser "sedang berlangsung".
  const menitSekarang = useMenitPerangkat(menitServer);
  const [jadwalId, setJadwalId] = useState("");
  const [presensi, setPresensi] = useState<Record<string, StatusPresensiMurid>>(
    {},
  );
  const [alasan, setAlasan] = useState<Record<string, string>>({});
  const [materi, setMateri] = useState("");
  const [topik, setTopik] = useState("");
  const [catatan, setCatatan] = useState("");
  // Isian yang dimuat saat sesinya dipilih; pembanding status simpan.
  const [dimuat, setDimuat] = useState<IsianJurnal | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errorJadwal, setErrorJadwal] = useState("");
  const [errorMateri, setErrorMateri] = useState("");
  const [terkirim, setTerkirim] = useState<RingkasanJurnal | null>(null);

  const jadwalTerpilih = jadwal.find((item) => item.id === jadwalId);
  const tersimpanTerpilih = jadwalTerpilih
    ? sudahDiisi[jadwalTerpilih.id]
    : undefined;
  const isian: IsianJurnal = { materi, topik, catatan, presensi, alasan };
  const statusSimpan = dimuat
    ? statusSimpanJurnal(tersimpanTerpilih, dimuat, isian)
    : "kosong";

  // Tombol kirim hanya aktif setelah data wajib lengkap, jadi guru tidak
  // pernah menekan tombol yang berakhir dengan error.
  const bagianKurang = [
    jadwalTerpilih ? null : "kelas & jam mengajar",
    materi ? null : "jenis materi",
  ].filter((bagian): bagian is string => bagian !== null);
  const siapKirim = bagianKurang.length === 0;

  function pilihJadwal(item: Jadwal) {
    const tersimpan = sudahDiisi[item.id];
    // Sesi yang jurnalnya sudah diisi hari ini dimuat apa adanya: guru
    // mengoreksi catatan yang sama, bukan menimpanya dengan isian kosong.
    const presensiAwal: Record<string, StatusPresensiMurid> =
      Object.fromEntries(
        item.murid.map((murid) => [
          murid.id,
          tersimpan ? (tersimpan.presensi[murid.id] ?? "alpa") : "hadir",
        ]),
      );
    setJadwalId(item.id);
    setErrorJadwal("");
    setErrorMateri("");
    setPresensi(presensiAwal);
    setAlasan(tersimpan?.alasan ?? {});
    setMateri(tersimpan?.materi ?? "");
    setTopik(tersimpan?.topik ?? "");
    setCatatan(tersimpan?.catatan ?? "");
    // Isian yang baru dimuat itu juga jadi pembanding status simpan, jadi
    // begitu guru mengubah salah satunya formulir tahu ada yang belum dikirim.
    setDimuat({
      materi: tersimpan?.materi ?? "",
      topik: tersimpan?.topik ?? "",
      catatan: tersimpan?.catatan ?? "",
      presensi: presensiAwal,
      alasan: tersimpan?.alasan ?? {},
    });
  }

  function ubahStatus(muridId: string, status: StatusPresensiMurid) {
    setPresensi((sebelumnya) => ({ ...sebelumnya, [muridId]: status }));
  }

  function ubahAlasan(muridId: string, nilai: string) {
    setAlasan((sebelumnya) => ({ ...sebelumnya, [muridId]: nilai }));
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
    // Kehadiran dikirim dalam bentuk yang dipakai tabelnya: `hadir` + catatan
    // berisi alasan (lihat `catatanDariPresensi`).
    const kehadiran = jadwalTerpilih.murid.map((murid) => {
      const status = presensi[murid.id] ?? "hadir";
      return {
        muridId: murid.id,
        hadir: status === "hadir",
        catatan: catatanDariPresensi(status, alasan[murid.id] ?? ""),
      };
    });
    const jurnal: JurnalInput = {
      jadwalId: jadwalTerpilih.id,
      materi: materiLengkap,
      catatan: catatan.trim(),
      kehadiran,
    };

    setPending(true);
    try {
      const jawaban = await fetch("/api/jurnal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jurnal),
      });
      if (!jawaban.ok) {
        setError(
          await pesanGalatApi(
            jawaban,
            "Jurnal gagal dikirim. Coba lagi sebentar lagi.",
          ),
        );
        return;
      }

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
          hadir: (presensi[murid.id] ?? "hadir") === "hadir",
          keterangan: catatanDariPresensi(
            presensi[murid.id] ?? "hadir",
            alasan[murid.id] ?? "",
          ),
        })),
      });
      // Halaman disegarkan supaya sesi yang baru dikirim ikut terbaca sebagai
      // jurnal tersimpan kalau guru mau mengisinya lagi hari ini.
      router.refresh();
    } catch {
      setError("Jurnal gagal dikirim. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  function isiJurnalLain() {
    setJadwalId("");
    setPresensi({});
    setAlasan({});
    setMateri("");
    setTopik("");
    setCatatan("");
    setDimuat(null);
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
        <Button asChild variant="outline" size="aksi">
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
            menitSekarang={menitSekarang}
            sudahDiisi={sudahDiisi}
          />

          {jadwalTerpilih && (
            <StatusSesiJurnal
              namaKelas={jadwalTerpilih.namaKelas}
              jamMulai={jadwalTerpilih.jamMulai}
              jamSelesai={jadwalTerpilih.jamSelesai}
              menitSekarang={menitSekarang}
            />
          )}

          {sudahDiisi[jadwalId] && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-6"
            >
              <Info
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <span>
                Jurnal sesi ini sudah diisi hari ini, jadi isi sebelumnya dimuat
                ulang di bawah. Kirim ulang memperbarui catatan yang sama —
                jumlahnya tetap satu.
              </span>
            </p>
          )}

          {jadwal.length > 0 && (
            <>
              {jadwalTerpilih ? (
                <DaftarKehadiran
                  murid={jadwalTerpilih.murid}
                  presensi={presensi}
                  catatan={alasan}
                  onStatus={ubahStatus}
                  onCatatan={ubahAlasan}
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
                <div className="space-y-1 text-sm leading-6 text-muted-foreground">
                  {!siapKirim && (
                    <p>Tinggal lengkapi: {bagianKurang.join(" dan ")}.</p>
                  )}
                  <p
                    aria-live="polite"
                    aria-busy={pending}
                    className="flex items-start gap-2"
                  >
                    {pending ? (
                      <LoaderCircle
                        className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : statusSimpan === "tersimpan" ? (
                      <CheckCheck
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleDashed
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      {!jadwalTerpilih
                        ? "Pilih kelas & jam mengajar dulu; durasi sesinya dihitung otomatis dari jadwal."
                        : pending
                          ? "Menyimpan isian jurnal…"
                          : error
                            ? "Isian ini belum tersimpan."
                            : pesanStatusSimpan(
                                statusSimpan,
                                tersimpanTerpilih,
                              )}
                    </span>
                  </p>
                </div>
                <Button
                  type="submit"
                  size="aksi"
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
                  {pending
                    ? "Mengirim…"
                    : sudahDiisi[jadwalId]
                      ? "Perbarui Jurnal"
                      : "Kirim Jurnal"}
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
