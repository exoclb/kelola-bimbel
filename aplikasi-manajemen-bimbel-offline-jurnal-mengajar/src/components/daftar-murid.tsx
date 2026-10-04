"use client";

import { useState } from "react";
import { CalendarDays, Phone, UserRound } from "lucide-react";
import { cn } from "cn";
import { FormTambahMurid } from "@/components/form-tambah-murid";
import { KolomPencarian } from "@/components/kolom-pencarian";
import { PesanKosong } from "@/components/status-antarmuka";
import { Card } from "@/components/ui/card";
import type { Murid } from "@/lib/mock-murid";
import { formatTanggalLengkap, hitungUsia } from "@/lib/tanggal";

type DaftarMuridProps = {
  daftarAwal: Murid[];
};

/**
 * Daftar murid bimbel: data tiap anak, orang tua yang bisa dihubungi, dan
 * statusnya masih aktif atau tidak. Murid baru ditambahkan lewat formulir di
 * atas daftar; datanya masih disimpan di layar, belum ke database.
 */
export function DaftarMurid({ daftarAwal }: DaftarMuridProps) {
  const [daftar, setDaftar] = useState(daftarAwal);
  const [pesan, setPesan] = useState("");
  const [cari, setCari] = useState("");

  const aktif = daftar.filter((murid) => murid.statusAktif).length;
  const kataKunci = cari.trim().toLowerCase();
  const cocok = kataKunci
    ? daftar.filter(
        // Sama seperti `?cari=` di /api/murid: nama anak, nama orang tua,
        // atau kontak orang tuanya.
        (murid) =>
          murid.nama.toLowerCase().includes(kataKunci) ||
          murid.namaOrangTua.toLowerCase().includes(kataKunci) ||
          murid.kontakOrangTua.toLowerCase().includes(kataKunci),
      )
    : daftar;

  function tambahMurid(murid: Murid) {
    setDaftar((sebelumnya) =>
      [...sebelumnya, murid].sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    );
    setPesan(`${murid.nama} ditambahkan ke daftar.`);
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
        {kataKunci && (
          <p role="status" className="text-sm text-muted-foreground">
            {cocok.length} dari {daftar.length} murid cocok dengan “
            {cari.trim()}”.
          </p>
        )}
        <FormTambahMurid onTambah={tambahMurid} />
        <p role="status" className="text-sm text-muted-foreground">
          {pesan}
        </p>
      </div>

      {cocok.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul={kataKunci ? "Tidak ada murid yang cocok" : "Belum ada murid"}
          keterangan={
            kataKunci
              ? `Coba kata kunci lain, atau hapus pencarian “${cari.trim()}”.`
              : "Data murid muncul di sini setelah ditambahkan."
          }
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {cocok.map((murid) => (
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
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: murid baru belum tersimpan di database — penyimpanannya
        menyusul bersama API data murid.
      </p>
    </div>
  );
}
