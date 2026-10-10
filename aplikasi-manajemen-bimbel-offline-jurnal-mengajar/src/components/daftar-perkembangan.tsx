"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileText,
  History,
  LoaderCircle,
  Pencil,
  Plus,
  UserRound,
} from "lucide-react";
import { CatatanSikapKehadiran } from "@/components/catatan-sikap-kehadiran";
import { FormCatatanAnak } from "@/components/form-catatan-anak";
import { LencanaNilai } from "@/components/lencana-nilai";
import { PesanKosong } from "@/components/status-antarmuka";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  CatatanPerkembanganTersimpan,
  RingkasanPerkembanganTersimpan,
} from "@/services/perkembangan.service";
import type { IsiCatatan } from "@/lib/perkembangan";
import { formatTanggalLengkap } from "@/lib/tanggal";

type MuridRingkas = { id: string; nama: string };

type DaftarPerkembanganProps = {
  /** Semua murid, dipakai untuk memilih anak saat menambah catatan. */
  daftarMurid: MuridRingkas[];
  /** Satu baris per anak yang sudah punya catatan, lengkap angka ringkasannya. */
  ringkasan: RingkasanPerkembanganTersimpan[];
  /** Catatan terakhir tiap anak (satu baris per anak) untuk isi kartunya. */
  catatanTerbaru: CatatanPerkembanganTersimpan[];
  jumlahMurid: number;
  jumlahCatatan: number;
};

/**
 * Perkembangan tiap anak: catatan terbaru dari guru — nilai, sikap, dan
 * catatannya — beserta berapa banyak catatan yang sudah terkumpul. Catatan
 * baru ditambahkan dan catatan terbaru bisa diubah dari kartu yang sama;
 * keduanya disimpan lewat API lalu halaman mengambil ulang datanya.
 */
export function DaftarPerkembangan({
  daftarMurid,
  ringkasan,
  catatanTerbaru,
  jumlahMurid,
  jumlahCatatan,
}: DaftarPerkembanganProps) {
  const router = useRouter();
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  const [pending, setPending] = useState(false);
  const [formUntuk, setFormUntuk] = useState<
    { muridId: string; muridNama: string; ubah: boolean } | undefined
  >();
  const [muridBaru, setMuridBaru] = useState("");

  const punyaCatatan = ringkasan.filter((baris) => baris.jumlahCatatan > 0);
  const terbaruPerMurid = new Map(
    catatanTerbaru.map((baris) => [baris.muridId, baris]),
  );

  async function simpanCatatan(
    murid: { id: string; nama: string },
    isi: IsiCatatan,
  ) {
    if (pending) return;
    setPending(true);
    setPesan("");
    setGalat("");

    const catatan = terbaruPerMurid.get(murid.id);
    const ubah = Boolean(formUntuk?.ubah && catatan);

    try {
      const jawaban = await fetch(
        ubah && catatan
          ? `/api/perkembangan/${catatan.id}`
          : "/api/perkembangan",
        {
          method: ubah ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ubah ? isi : { muridId: murid.id, ...isi }),
        },
      );
      if (!jawaban.ok) throw new Error("gagal");

      setFormUntuk(undefined);
      setPesan(
        ubah
          ? `Catatan ${murid.nama} diperbarui.`
          : `Catatan baru untuk ${murid.nama} tersimpan.`,
      );
      router.refresh();
    } catch {
      setGalat(
        `Catatan ${murid.nama} belum bisa disimpan. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Perkembangan Anak</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Perkembangan Anak
      </h1>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base leading-7 text-muted-foreground">
          {punyaCatatan.length === 0
            ? "Belum ada catatan perkembangan."
            : `${punyaCatatan.length} dari ${jumlahMurid} murid punya catatan · ${jumlahCatatan} catatan terkumpul.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="aksi"
            disabled={pending || daftarMurid.length === 0}
            onClick={() => {
              const murid =
                daftarMurid.find((anak) => anak.id === muridBaru) ??
                daftarMurid[0];
              if (!murid) return;
              setFormUntuk({
                muridId: murid.id,
                muridNama: murid.nama,
                ubah: false,
              });
            }}
          >
            <Plus aria-hidden="true" />
            Tambah catatan
          </Button>
          <Button asChild variant="outline" size="aksi">
            <Link href="/app/perkembangan/riwayat">
              <History aria-hidden="true" />
              Riwayat perkembangan
            </Link>
          </Button>
        </div>
      </div>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
      </p>
      {galat && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {galat}
        </p>
      )}

      {formUntuk && !formUntuk.ubah && (
        <Card className="mt-4 gap-3 px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="murid-catatan-baru">Murid</Label>
            <NativeSelect
              className="h-[var(--target-sentuh-portal)] md:text-base"
              id="murid-catatan-baru"
              value={formUntuk.muridId}
              onChange={(event) => {
                setMuridBaru(event.target.value);
                const murid = daftarMurid.find(
                  (anak) => anak.id === event.target.value,
                );
                if (murid)
                  setFormUntuk({
                    muridId: murid.id,
                    muridNama: murid.nama,
                    ubah: false,
                  });
              }}
            >
              {daftarMurid.map((murid) => (
                <option key={murid.id} value={murid.id}>
                  {murid.nama}
                </option>
              ))}
            </NativeSelect>
          </div>
          <FormCatatanAnak
            namaMurid={formUntuk.muridNama}
            onSimpan={(isi) =>
              void simpanCatatan(
                { id: formUntuk.muridId, nama: formUntuk.muridNama },
                isi,
              )
            }
            onBatal={() => setFormUntuk(undefined)}
          />
        </Card>
      )}

      {punyaCatatan.length === 0 ? (
        <PesanKosong
          className="mt-4"
          judul="Belum ada catatan"
          keterangan={
            daftarMurid.length === 0
              ? "Tambahkan murid dulu di halaman Data Murid & Kelas; catatan nilai dan sikapnya bisa diisi di sini setelah itu."
              : "Catatan nilai dan sikap anak muncul di sini setelah guru mengisinya. Pakai tombol Tambah catatan di atas untuk mengisi yang pertama."
          }
        />
      ) : (
        <ul className="mt-4 space-y-3">
          {punyaCatatan.map((baris) => {
            const murid = { id: baris.muridId, nama: baris.muridNama };
            const terbaru = terbaruPerMurid.get(baris.muridId);
            const formIni = formUntuk?.muridId === baris.muridId;
            const tanggalTerakhir =
              baris.tanggalCatatanTerakhir ?? terbaru?.tanggal ?? "";

            return (
              <li key={baris.muridId}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{murid.nama}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {tanggalTerakhir && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays
                              className="size-4"
                              aria-hidden="true"
                            />
                            {formatTanggalLengkap(tanggalTerakhir)}
                          </span>
                        )}
                        {terbaru && (
                          <span className="inline-flex items-center gap-1.5">
                            <UserRound className="size-4" aria-hidden="true" />
                            {terbaru.guruNama}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5">
                          <ClipboardList
                            className="size-4"
                            aria-hidden="true"
                          />
                          {baris.jumlahCatatan} catatan
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {baris.nilaiTerakhir !== null && (
                        <LencanaNilai nilai={baris.nilaiTerakhir} />
                      )}
                      {baris.sikapTerakhir && (
                        <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">
                          {baris.sikapTerakhir}
                        </span>
                      )}
                    </div>
                  </div>

                  {terbaru && (
                    <p className="text-sm">
                      {terbaru.catatanPerkembangan || (
                        <span className="text-muted-foreground">
                          Tanpa catatan tertulis.
                        </span>
                      )}
                    </p>
                  )}

                  <CatatanSikapKehadiran
                    jumlahPertemuan={baris.jumlahPertemuan}
                    jumlahHadir={baris.jumlahHadir}
                    sikap={baris.sikapTerakhir ?? "-"}
                  />

                  {formIni ? (
                    <FormCatatanAnak
                      namaMurid={murid.nama}
                      catatanAwal={
                        terbaru
                          ? {
                              tanggal: terbaru.tanggal,
                              nilai: terbaru.nilai,
                              sikap: terbaru.sikap,
                              catatanPerkembangan: terbaru.catatanPerkembangan,
                            }
                          : undefined
                      }
                      onSimpan={(isi) => void simpanCatatan(murid, isi)}
                      onBatal={() => setFormUntuk(undefined)}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="aksi"
                        disabled={pending}
                        onClick={() =>
                          setFormUntuk({
                            muridId: baris.muridId,
                            muridNama: baris.muridNama,
                            ubah: false,
                          })
                        }
                      >
                        {pending ? (
                          <LoaderCircle
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : (
                          <Plus aria-hidden="true" />
                        )}
                        Tambah catatan
                      </Button>
                      {terbaru && (
                        <Button
                          type="button"
                          variant="outline"
                          size="aksi"
                          disabled={pending}
                          onClick={() =>
                            setFormUntuk({
                              muridId: baris.muridId,
                              muridNama: baris.muridNama,
                              ubah: true,
                            })
                          }
                        >
                          <Pencil aria-hidden="true" />
                          Ubah catatan terbaru
                        </Button>
                      )}
                      <Button asChild variant="outline" size="aksi">
                        <Link href={`/app/perkembangan/${baris.muridId}`}>
                          <FileText aria-hidden="true" />
                          Laporan orang tua
                        </Link>
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
