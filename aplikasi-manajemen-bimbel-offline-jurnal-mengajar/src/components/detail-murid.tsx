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
import { FormUbahMurid } from "@/components/form-ubah-murid";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PesanKosong } from "@/components/status-antarmuka";
import type { Kelas } from "@/lib/mock-kelas";
import type { Murid } from "@/lib/mock-murid";
import type { Penempatan } from "@/lib/mock-penempatan";
import {
  kelasBelumDiikuti,
  periksaPenempatan,
  penghalangCabang,
} from "@/lib/penempatan-kelas";
import { formatTanggalLengkap, hitungUsia, tanggalISO } from "@/lib/tanggal";
import type { Cabang } from "@/services/cabang.service";

type DetailMuridProps = {
  muridAwal: Murid;
  daftarKelas: Kelas[];
  /** Semua cabang dari layanan cabang, urut nama. */
  daftarCabang: Cabang[];
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
 * mengganggu kelas lainnya. Identitas anaknya (nama, tanggal lahir, orang tua,
 * status aktif) juga bisa diperbaiki lewat formulir yang sama dengan halaman
 * daftar.
 *
 * Penempatan barunya diperiksa dulu (`src/lib/penempatan-kelas.ts`): anak yang
 * sudah tidak aktif, kelas di cabang nonaktif, dan kelas yang cabangnya belum
 * terdaftar ditolak dengan alasannya di layar, bukan diam-diam tersimpan.
 * Datanya masih tiruan dan hanya berlaku di layar.
 */
export function DetailMurid({
  muridAwal,
  daftarKelas,
  daftarCabang,
  penempatanAwal,
}: DetailMuridProps) {
  const [murid, setMurid] = useState(muridAwal);
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
  const kelasDitawarkan = kelasBelumDiikuti({
    muridId: murid.id,
    daftarKelas,
    penempatan,
  });
  // Kelas di cabang nonaktif (atau yang cabangnya belum terdaftar) tetap
  // ditampilkan supaya alasannya bisa dibaca, tetapi penempatannya ditolak saat
  // disimpan — sama seperti pemindahan kelas yang tidak menawarkan cabang
  // nonaktif.
  const kelasPerluCabang = kelasDitawarkan.filter(
    (kelas) => penghalangCabang(kelas, daftarCabang) !== null,
  );
  const kelasSiapDipakai = kelasDitawarkan.filter(
    (kelas) => penghalangCabang(kelas, daftarCabang) === null,
  );

  function tambahKeKelas(kelasTerpilih: string) {
    const hasil = periksaPenempatan({
      murid,
      kelasId: kelasTerpilih,
      daftarKelas,
      daftarCabang,
      // Cermin penempatan yang diperbarui seketika, supaya dua klik pada render
      // yang sama tetap ditolak sebagai penempatan dobel, bukan diam-diam
      // menambah kelas lain.
      penempatan: penempatanTerkini.current,
    });
    if (!hasil.boleh) {
      tampilkanGalat(hasil.pesan);
      return;
    }

    const kelas = daftarKelas.find((item) => item.id === kelasTerpilih);
    if (!kelas) return;

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
          <FormUbahMurid
            murid={murid}
            onUbah={(baru) => {
              setMurid(baru);
              tampilkanPesan(
                `Data ${baru.nama} diperbarui. Perubahannya berlaku di layar ini.`,
              );
            }}
          />
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
          <>
            {kelasPerluCabang.length > 0 && (
              <p className="rounded-lg border border-dashed px-3 py-2 text-sm leading-6 text-muted-foreground">
                {kelasPerluCabang.length} kelas belum bisa dipakai karena
                cabangnya nonaktif atau belum terdaftar; pilih salah satunya
                untuk melihat alasannya.
              </p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="kelas-baru">Kelas</Label>
                <NativeSelect
                  id="kelas-baru"
                  value={kelasBaru}
                  onChange={(event) => setKelasBaru(event.target.value)}
                >
                  <option value="">Pilih kelas…</option>
                  {kelasDitawarkan.map((kelas) => {
                    const penghalang = penghalangCabang(kelas, daftarCabang);
                    const tanda =
                      penghalang?.alasan === "cabang_nonaktif"
                        ? " (cabang nonaktif)"
                        : penghalang
                          ? " (cabang belum terdaftar)"
                          : "";
                    return (
                      <option key={kelas.id} value={kelas.id}>
                        {kelas.namaKelas} · {kelas.cabang}
                        {tanda}
                      </option>
                    );
                  })}
                </NativeSelect>
              </div>
              <Button
                type="button"
                size="sm"
                // Tanpa pilihan yang sah tombolnya mati: satu pilihan menyimpan
                // satu kelas, dan setelah tersimpan pilihannya dikosongkan lagi
                // supaya klik beruntun tidak menambah kelas lain.
                disabled={!kelasBaru}
                onClick={() => tambahKeKelas(kelasBaru)}
              >
                <UserPlus aria-hidden="true" />
                Masukkan ke kelas
              </Button>
            </div>
            {kelasSiapDipakai.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Semua kelas yang tersisa berada di cabang nonaktif atau belum
                terdaftar.
              </p>
            )}
          </>
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
        Catatan: data murid dan penempatan di halaman ini masih data tiruan —
        berlaku di layar sampai penyimpanannya tersambung ke database.
      </p>
    </div>
  );
}
