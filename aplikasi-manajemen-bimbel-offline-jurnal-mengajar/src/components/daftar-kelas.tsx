"use client";

import { useState } from "react";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { FormTambahKelas } from "@/components/form-tambah-kelas";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Kelas } from "@/lib/mock-kelas";

type DaftarKelasProps = {
  daftarAwal: Kelas[];
};

/**
 * Kelola kelas dan jadwalnya: satu kartu per kelas berisi guru pengampu,
 * cabang, jumlah murid, dan jadwal mengajar mingguannya. Kelas baru ditambahkan
 * lewat formulir di atas daftar; datanya masih disimpan di layar.
 */
export function DaftarKelas({ daftarAwal }: DaftarKelasProps) {
  const [daftar, setDaftar] = useState(daftarAwal);
  const [pesan, setPesan] = useState("");

  const jumlahJadwal = daftar.reduce(
    (jumlah, kelas) => jumlah + kelas.jadwal.length,
    0,
  );

  function tambahKelas(kelas: Kelas) {
    setDaftar((sebelumnya) =>
      [...sebelumnya, kelas].sort((a, b) =>
        a.namaKelas.localeCompare(b.namaKelas, "id"),
      ),
    );
    setPesan(`Kelas ${kelas.namaKelas} ditambahkan.`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 text-sm font-medium text-primary">
        Data Murid &amp; Kelas
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Kelola Kelas &amp; Jadwal
      </h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        {daftar.length === 0
          ? "Belum ada kelas yang dibuat."
          : `${daftar.length} kelas · ${jumlahJadwal} jadwal mengajar.`}
      </p>

      <div className="mt-8 space-y-3">
        <FormTambahKelas onTambah={tambahKelas} />
        <p role="status" className="text-sm text-muted-foreground">
          {pesan}
        </p>
      </div>

      {daftar.length === 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Belum ada kelas</CardTitle>
            <CardDescription>
              Kelas muncul di sini setelah ditambahkan.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {daftar.map((kelas) => (
            <li key={kelas.id}>
              <Card className="gap-3 px-5 py-4">
                <div className="space-y-1">
                  <p className="font-medium">{kelas.namaKelas}</p>
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-4" aria-hidden="true" />
                      {kelas.cabang}
                    </span>
                    <span>Guru: {kelas.guruNama}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="size-4" aria-hidden="true" />
                      {kelas.jumlahMurid} murid
                    </span>
                  </p>
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
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: kelas baru belum tersimpan di database — penyimpanannya
        menyusul bersama API kelas.
      </p>
    </div>
  );
}
