"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Phone,
  UserPlus,
  UserRound,
  UserRoundMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PesanKosong } from "@/components/status-antarmuka";
import type { Kelas } from "@/lib/mock-kelas";
import type { Murid } from "@/lib/mock-murid";
import type { Penempatan } from "@/lib/mock-penempatan";
import { formatTanggalLengkap, hitungUsia, tanggalISO } from "@/lib/tanggal";

type DetailMuridProps = {
  murid: Murid;
  daftarKelas: Kelas[];
  penempatanAwal: Penempatan[];
};

/** Satu kelas yang diikuti murid: nama, guru, jadwal, dan sejak kapan. */
function KartuKelas({
  kelas,
  baris,
  aksi,
}: {
  kelas: Kelas;
  baris: Penempatan;
  aksi?: React.ReactNode;
}) {
  return (
    <Card className="gap-3 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{kelas.namaKelas}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden="true" />
              {kelas.cabang}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-4" aria-hidden="true" />
              {kelas.guruNama}
            </span>
          </p>
        </div>
        <span
          className={
            baris.status === "aktif"
              ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {baris.status === "aktif" ? "Sedang diikuti" : "Sudah selesai"}
        </span>
      </div>

      {kelas.jadwal.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada jadwal untuk kelas ini.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {kelas.jadwal.map((jadwal) => (
            <li
              key={`${jadwal.hari}-${jadwal.jamMulai}`}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground"
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {jadwal.hari}
              <Clock className="ml-1 size-3.5" aria-hidden="true" />
              {jadwal.jamMulai}–{jadwal.jamSelesai}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {baris.status === "aktif" ? "Sejak" : "Pernah diikuti sejak"}{" "}
          {formatTanggalLengkap(baris.tanggalMulai)}.
        </p>
        {aksi}
      </div>
    </Card>
  );
}

/**
 * Detail murid beserta kelas yang sedang dan pernah diikutinya. Sejak aturan
 * multi-kelas, murid boleh aktif di beberapa kelas sekaligus: dari halaman ini
 * kelas tambahan bisa langsung ditambahkan, dan keluar dari satu kelas tidak
 * mengganggu kelas lainnya. Datanya masih tiruan dan hanya berlaku di layar.
 */
export function DetailMurid({
  murid,
  daftarKelas,
  penempatanAwal,
}: DetailMuridProps) {
  const [penempatan, setPenempatan] = useState(penempatanAwal);
  /**
   * Cermin penempatan yang diperbarui seketika, supaya dua klik pada render
   * yang sama tidak bisa menyisipkan penempatan dobel.
   */
  const penempatanTerkini = useRef(penempatanAwal);
  const [kelasBaru, setKelasBaru] = useState("");
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");

  function tampilkanPesan(teks: string) {
    setPesan(teks);
    setGalat("");
  }

  function tampilkanGalat(teks: string) {
    setGalat(teks);
    setPesan("");
  }

  function simpanPenempatan(baru: Penempatan[]) {
    penempatanTerkini.current = baru;
    setPenempatan(baru);
  }

  const baris = penempatan
    .filter((item) => item.muridId === murid.id)
    .map((item) => {
      const kelas = daftarKelas.find(
        (barisKelas) => barisKelas.id === item.kelasId,
      );
      return kelas ? { ...item, kelas } : undefined;
    })
    .filter((item): item is Penempatan & { kelas: Kelas } => item !== undefined)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "aktif" ? -1 : 1;
      return b.tanggalMulai.localeCompare(a.tanggalMulai);
    });

  const kelasAktif = baris.filter((item) => item.status === "aktif");
  const riwayatKelas = baris.filter((item) => item.status === "selesai");

  // Kelas yang belum aktif untuk murid ini; kelas yang pernah diikuti tetap
  // boleh dipilih lagi, sedangkan kelas yang sedang aktif tidak ditawarkan.
  const kelasAktifIds = new Set(kelasAktif.map((item) => item.kelasId));
  const kelasDitawarkan = daftarKelas.filter(
    (kelas) => !kelasAktifIds.has(kelas.id),
  );
  const pilihan = kelasBaru || kelasDitawarkan[0]?.id || "";

  function tambahKeKelas() {
    if (!pilihan) return;
    const kelas = daftarKelas.find((item) => item.id === pilihan);
    if (!kelas) return;

    const sudahAda = penempatanTerkini.current.find(
      (item) =>
        item.muridId === murid.id &&
        item.kelasId === kelas.id &&
        item.status === "aktif",
    );
    if (sudahAda) {
      tampilkanGalat(`${murid.nama} sudah terdaftar di kelas ini.`);
      return;
    }

    simpanPenempatan([
      ...penempatanTerkini.current,
      {
        muridId: murid.id,
        kelasId: kelas.id,
        tanggalMulai: tanggalISO(new Date()),
        status: "aktif",
      },
    ]);
    setKelasBaru("");
    tampilkanPesan(`${murid.nama} ditambahkan ke ${kelas.namaKelas}.`);
  }

  function keluarkanDariKelas(kelas: Kelas) {
    simpanPenempatan(
      penempatanTerkini.current.map((item) =>
        item.muridId === murid.id &&
        item.kelasId === kelas.id &&
        item.status === "aktif"
          ? { ...item, status: "selesai" }
          : item,
      ),
    );
    tampilkanPesan(
      `${murid.nama} dikeluarkan dari ${kelas.namaKelas}. Kelas lain tidak terpengaruh.`,
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/app/murid">
            <ArrowLeft aria-hidden="true" />
            Kembali ke daftar murid
          </Link>
        </Button>
      </div>

      <p className="mb-3 text-sm font-medium text-primary">
        Data Murid &amp; Kelas
      </p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {murid.nama}
        </h1>
        <span
          className={
            murid.statusAktif
              ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {murid.statusAktif ? "Aktif" : "Tidak aktif"}
        </span>
      </div>

      <Card className="mt-6 gap-3 px-5 py-4">
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden="true" />
              {formatTanggalLengkap(murid.tanggalLahir)} ·{" "}
              {hitungUsia(murid.tanggalLahir)} tahun
            </span>
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {murid.namaOrangTua && (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4" aria-hidden="true" />
                {murid.namaOrangTua}
              </span>
            )}
            {murid.kontakOrangTua && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" aria-hidden="true" />
                {murid.kontakOrangTua}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/perkembangan/${murid.id}`}>
              Laporan perkembangan
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </Card>

      <p role="status" className="mt-4 text-sm text-muted-foreground">
        {pesan}
      </p>
      {galat && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {galat}
        </p>
      )}

      <h2 className="mt-6 text-xl font-semibold tracking-tight">
        Kelas yang sedang diikuti ({kelasAktif.length})
      </h2>
      {kelasAktif.length === 0 ? (
        <PesanKosong
          className="mt-3"
          judul="Belum ikut kelas mana pun"
          keterangan="Tambahkan murid ini ke salah satu kelas lewat pilihan di bawah."
        />
      ) : (
        <ul className="mt-3 space-y-3">
          {kelasAktif.map((item) => (
            <li key={`${item.kelasId}-${item.tanggalMulai}`}>
              <KartuKelas
                kelas={item.kelas}
                baris={item}
                aksi={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => keluarkanDariKelas(item.kelas)}
                  >
                    <UserRoundMinus aria-hidden="true" />
                    Keluarkan dari kelas ini
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-6 gap-3 px-5 py-4">
        <p className="text-sm font-medium">Tambah ke kelas lain</p>
        {kelasDitawarkan.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Murid ini sudah aktif di semua kelas.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="kelas-baru">Kelas</Label>
              <NativeSelect
                id="kelas-baru"
                value={pilihan}
                onChange={(event) => setKelasBaru(event.target.value)}
              >
                {kelasDitawarkan.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {kelas.namaKelas} · {kelas.cabang}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="button" size="sm" onClick={tambahKeKelas}>
              <UserPlus aria-hidden="true" />
              Masukkan ke kelas
            </Button>
          </div>
        )}
      </Card>

      <h2 className="mt-8 text-xl font-semibold tracking-tight">
        Riwayat kelas ({riwayatKelas.length})
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Kelas yang sudah tidak diikuti lagi; catatan lama tetap tersimpan.
      </p>
      {riwayatKelas.length === 0 ? (
        <PesanKosong
          className="mt-3"
          judul="Belum ada riwayat kelas"
          keterangan="Riwayat muncul setelah murid keluar dari sebuah kelas."
        />
      ) : (
        <ul className="mt-3 space-y-3">
          {riwayatKelas.map((item) => (
            <li key={`${item.kelasId}-${item.tanggalMulai}`}>
              <KartuKelas kelas={item.kelas} baris={item} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: penempatan di halaman ini masih data tiruan — berlaku di layar
        sampai penyimpanannya tersambung ke database.
      </p>
    </div>
  );
}
