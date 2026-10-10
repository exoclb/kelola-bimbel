"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { cn } from "cn";
import { FormTambahMurid } from "@/components/form-tambah-murid";
import { KolomPencarian } from "@/components/kolom-pencarian";
import { PesanKosong } from "@/components/status-antarmuka";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/card";
import type { Murid } from "@/lib/mock-murid";
import type { Kelas } from "@/lib/mock-kelas";
import type { Penempatan } from "@/lib/mock-penempatan";
import {
  kelasAktifMurid,
  opsiSaringanMurid,
  saringDaftarMurid,
  type SaringanStatusMurid,
} from "@/lib/murid";
import { formatTanggalLengkap, hitungUsia } from "@/lib/tanggal";

type DaftarMuridProps = {
  daftarAwal: Murid[];
  /** Kelas dan penempatan dipakai menyaring murid menurut cabang dan kelasnya. */
  daftarKelas: Kelas[];
  penempatanAwal: Penempatan[];
};

/**
 * Daftar murid bimbel: data tiap anak, orang tua yang bisa dihubungi, kelas
 * yang sedang diikutinya, dan statusnya masih aktif atau tidak. Murid baru
 * ditambahkan lewat formulir di atas daftar; datanya masih disimpan di layar,
 * belum ke database.
 */
export function DaftarMurid({
  daftarAwal,
  daftarKelas,
  penempatanAwal,
}: DaftarMuridProps) {
  const [daftar, setDaftar] = useState(daftarAwal);
  const [pesan, setPesan] = useState("");
  const [cari, setCari] = useState("");
  const [saringan, setSaringan] = useState<SaringanStatusMurid>("semua");
  const [cabang, setCabang] = useState("");
  const [kelasId, setKelasId] = useState("");
  const idSaring = useId();
  const idCabang = useId();
  const idKelas = useId();

  const aktif = daftar.filter((murid) => murid.statusAktif).length;
  const opsi = opsiSaringanMurid(daftarKelas, penempatanAwal);
  // Pilihan kelas mengikuti cabang yang sedang dipilih supaya tidak ada kelas
  // cabang lain yang ikut ditawarkan. Murid baru boleh jadi tidak punya kelas
  // (pendaftarannya menyusul), jadi penyaringnya tetap hasil data penempatan.
  const opsiKelas = opsi.kelas.filter(
    (kelas) => !cabang || kelas.cabang === cabang,
  );
  const cocok = saringDaftarMurid(
    daftar,
    { cari, status: saringan, cabang, kelasId },
    daftarKelas,
    penempatanAwal,
  );

  const kataKunci = cari.trim();
  const namaKelasTerpilih = opsi.kelas.find((kelas) => kelas.id === kelasId);
  const adaSaringan =
    Boolean(kataKunci) ||
    saringan !== "semua" ||
    Boolean(cabang) ||
    Boolean(kelasId);

  function tambahMurid(murid: Murid) {
    setDaftar((sebelumnya) =>
      [...sebelumnya, murid].sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    );
    setPesan(`${murid.nama} ditambahkan ke daftar.`);
  }

  function pilihCabang(nilai: string) {
    setCabang(nilai);
    // Kelas dari cabang lain tidak berlaku lagi begitu cabangnya berganti.
    setKelasId("");
  }

  function hapusSaringan() {
    setCari("");
    setSaringan("semua");
    setCabang("");
    setKelasId("");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">
        Data Murid &amp; Kelas
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Daftar Murid
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length === 0
          ? "Belum ada murid yang terdaftar."
          : `${daftar.length} murid terdaftar · ${aktif} masih aktif.`}
      </p>

      <div className="mt-8 space-y-3">
        <KolomPencarian
          nilai={cari}
          onUbah={setCari}
          label="Cari murid"
          placeholder="Cari nama, orang tua, atau kontak…"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={idSaring}>Status murid</Label>
            <NativeSelect
              className="h-[var(--target-sentuh-portal)] md:text-base"
              id={idSaring}
              value={saringan}
              onChange={(event) =>
                setSaringan(event.target.value as SaringanStatusMurid)
              }
            >
              <option value="semua">Semua status</option>
              <option value="aktif">Hanya yang aktif</option>
              <option value="nonaktif">Hanya yang tidak aktif</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={idCabang}>Cabang</Label>
            <NativeSelect
              className="h-[var(--target-sentuh-portal)] md:text-base"
              id={idCabang}
              value={cabang}
              onChange={(event) => pilihCabang(event.target.value)}
            >
              <option value="">Semua cabang</option>
              {opsi.cabang.map((nama) => (
                <option key={nama} value={nama}>
                  {nama}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={idKelas}>Kelas</Label>
            <NativeSelect
              className="h-[var(--target-sentuh-portal)] md:text-base"
              id={idKelas}
              value={kelasId}
              onChange={(event) => setKelasId(event.target.value)}
            >
              <option value="">Semua kelas</option>
              {opsiKelas.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.namaKelas}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {adaSaringan && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="text-sm text-muted-foreground">
              {cocok.length} dari {daftar.length} murid cocok
              {kataKunci ? ` dengan “${kataKunci}”` : ""}
              {saringan === "aktif"
                ? " dan masih aktif"
                : saringan === "nonaktif"
                  ? " dan tidak aktif"
                  : ""}
              {cabang ? ` di ${cabang}` : ""}
              {namaKelasTerpilih
                ? `${cabang ? " lewat" : " di"} kelas ${namaKelasTerpilih.namaKelas}`
                : ""}
              .
            </p>
            <Button
              type="button"
              variant="ghost"
              size="aksi"
              onClick={hapusSaringan}
            >
              Hapus saringan
            </Button>
          </div>
        )}
        <FormTambahMurid onTambah={tambahMurid} />
        <p role="status" className="text-sm text-muted-foreground">
          {pesan}
        </p>
      </div>

      {cocok.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul={adaSaringan ? "Tidak ada murid yang cocok" : "Belum ada murid"}
          keterangan={
            adaSaringan
              ? "Coba kata kunci lain, atau ubah saringan status, cabang, dan kelasnya."
              : "Data murid muncul di sini setelah ditambahkan."
          }
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {cocok.map((murid) => {
            const kelasAktif = kelasAktifMurid(
              murid.id,
              daftarKelas,
              penempatanAwal,
            );
            return (
              <li key={murid.id}>
                <Card className="gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{murid.nama}</p>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {formatTanggalLengkap(murid.tanggalLahir)} ·{" "}
                          {hitungUsia(murid.tanggalLahir)} tahun
                        </span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                        murid.statusAktif
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {murid.statusAktif ? "Aktif" : "Tidak aktif"}
                    </span>
                  </div>
                  {kelasAktif.length > 0 && (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <MapPin className="size-4" aria-hidden="true" />
                      {kelasAktif.map((kelas) => (
                        <span key={kelas.id}>
                          {kelas.namaKelas} · {kelas.cabang}
                        </span>
                      ))}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="aksi">
                      <Link href={`/app/murid/${murid.id}`}>
                        Detail murid
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                  {(murid.namaOrangTua || murid.kontakOrangTua) && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
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
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: murid baru belum tersimpan di database — penyimpanannya
        menyusul bersama API data murid.
      </p>
    </div>
  );
}
