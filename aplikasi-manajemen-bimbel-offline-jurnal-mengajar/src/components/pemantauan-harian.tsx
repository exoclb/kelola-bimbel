import Link from "next/link";
import { ArrowLeft, ClipboardList, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PesanKosong } from "@/components/status-antarmuka";
import { PanelJurnal } from "@/components/panel-jurnal";
import { DaftarNotifikasi } from "@/components/daftar-notifikasi";
import { PanelNotifikasi } from "@/components/panel-notifikasi";
import { SaringPemantauan } from "@/components/saring-pemantauan";
import {
  DaftarStatusGuru,
  RingkasanStatusGuru,
} from "@/components/status-guru-hari-ini";
import { formatJam } from "@/lib/jurnal";
import type {
  JurnalHarian,
  KehadiranJurnal,
  KelasKosong,
  StatusGuruHariIni,
} from "@/services/pemantauan.service";
import type { NotifikasiTersimpan } from "@/services/notifikasi.service";

type PemantauanHarianProps = {
  data: JurnalHarian[];
  kelasKosong: KelasKosong[];
  saring: {
    kelas: { classId: string; namaKelas: string; cabang: string }[];
    guru: { guruId: string; guruNama: string }[];
    cabang: string[];
    nilai: { classId: string; guruId: string; cabang: string };
    adaSaringan: boolean;
  };
  statusGuru: StatusGuruHariIni[];
  notifikasi: NotifikasiTersimpan[];
  belumDibaca: number;
  kehadiran: Record<string, KehadiranJurnal[]>;
  tanggalTampil: string;
  namaOwner: string;
  hasMore: boolean;
};

/**
 * Pantauan owner untuk satu hari: siapa saja yang sudah mengirim jurnal, apa
 * yang diajarkan, dan berapa jam yang tercatat. Jurnalnya dikelompokkan per
 * guru supaya satu layar cukup untuk memeriksa semuanya.
 */
export function PemantauanHarian({
  data,
  kelasKosong,
  saring,
  statusGuru,
  notifikasi,
  belumDibaca,
  kehadiran,
  tanggalTampil,
  namaOwner,
  hasMore,
}: PemantauanHarianProps) {
  const perGuru = data.reduce<
    {
      guruId: string;
      guruNama: string;
      guruEmail: string;
      jurnal: JurnalHarian[];
    }[]
  >((daftar, jurnal) => {
    const guru = daftar.find((baris) => baris.guruId === jurnal.guruId);
    if (guru) guru.jurnal.push(jurnal);
    else
      daftar.push({
        guruId: jurnal.guruId,
        guruNama: jurnal.guruNama,
        guruEmail: jurnal.guruEmail,
        jurnal: [jurnal],
      });
    return daftar;
  }, []);

  const totalJam = data.reduce(
    (jumlah, jurnal) => jumlah + jurnal.jamMengajar,
    0,
  );
  const statistik = [
    {
      label: "Guru sudah mengisi",
      nilai: String(perGuru.length),
      ikon: Users,
    },
    {
      label: "Jurnal hari ini",
      nilai: String(data.length),
      ikon: ClipboardList,
    },
    {
      label: "Jam mengajar tercatat",
      nilai: formatJam(totalJam),
      ikon: Clock,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">Pemantauan Owner</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Pemantauan Harian
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {tanggalTampil} · dipantau oleh {namaOwner}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {statistik.map(({ label, nilai, ikon: Ikon }) => (
          <Card key={label} className="gap-1 px-5 py-4">
            <CardDescription className="inline-flex items-center gap-1.5">
              <Ikon className="size-4" aria-hidden="true" />
              {label}
            </CardDescription>
            <p className="text-2xl font-semibold tracking-tight">{nilai}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <SaringPemantauan
          kelas={saring.kelas}
          guru={saring.guru}
          cabang={saring.cabang}
          nilai={saring.nilai}
          adaSaringan={saring.adaSaringan}
        />
      </div>

      <div className="mt-6 space-y-6">
        <PanelNotifikasi kelasKosong={kelasKosong} />
        <DaftarNotifikasi notifikasi={notifikasi} belumDibaca={belumDibaca} />
        <RingkasanStatusGuru daftar={statusGuru} />
        <DaftarStatusGuru daftar={statusGuru} />
      </div>

      {data.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul={
            saring.adaSaringan
              ? "Tidak ada jurnal yang cocok dengan saringan"
              : "Belum ada jurnal hari ini"
          }
          keterangan={
            saring.adaSaringan
              ? "Coba ganti kelas, guru, atau cabangnya."
              : "Begitu guru mengirim jurnal, isinya langsung muncul di halaman ini."
          }
        />
      ) : (
        <div className="mt-8 space-y-6">
          {perGuru.map((guru) => (
            <Card key={guru.guruId}>
              <CardHeader>
                <CardTitle>{guru.guruNama}</CardTitle>
                <CardDescription>
                  {guru.jurnal.length} jurnal ·{" "}
                  {formatJam(
                    guru.jurnal.reduce(
                      (jumlah, jurnal) => jumlah + jurnal.jamMengajar,
                      0,
                    ),
                  )}{" "}
                  mengajar · {guru.guruEmail}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {guru.jurnal.map((jurnal) => (
                    <PanelJurnal
                      key={jurnal.id}
                      jurnal={jurnal}
                      kehadiran={kehadiran[jurnal.id] ?? []}
                    />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {hasMore && (
        <p className="mt-4 text-sm text-muted-foreground">
          Menampilkan sebagian jurnal. Sisa jurnal bisa dimuat bertahap pada
          halaman berikutnya.
        </p>
      )}

      <div className="mt-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/app">
            <ArrowLeft aria-hidden="true" />
            Kembali ke beranda
          </Link>
        </Button>
      </div>
    </div>
  );
}
