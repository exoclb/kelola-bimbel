"use client";

import { useState } from "react";
import { CalendarDays, Clock, MapPin, Users, X } from "lucide-react";
import { FormJadwalKelas } from "@/components/form-jadwal-kelas";
import { FormTambahKelas } from "@/components/form-tambah-kelas";
import { KolomPencarian } from "@/components/kolom-pencarian";
import { PesanKosong } from "@/components/status-antarmuka";
import {
  PanelPenempatan,
  type MuridDiKelas,
} from "@/components/panel-penempatan";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { JadwalKelas, Kelas } from "@/lib/mock-kelas";
import type { Murid } from "@/lib/mock-murid";
import type { Penempatan } from "@/lib/mock-penempatan";
import { tanggalISO } from "@/lib/tanggal";

type DaftarKelasProps = {
  daftarAwal: Kelas[];
  daftarMurid: Murid[];
  penempatanAwal: Penempatan[];
};

/**
 * Kelola kelas, jadwalnya, dan murid yang ditempatkan di dalamnya. Semua
 * perubahan masih disimpan di layar; penyimpanan ke database menyusul bersama
 * API kelas dan penempatan.
 */
export function DaftarKelas({
  daftarAwal,
  daftarMurid,
  penempatanAwal,
}: DaftarKelasProps) {
  const [daftar, setDaftar] = useState(daftarAwal);
  const [penempatan, setPenempatan] = useState(penempatanAwal);
  const [pesan, setPesan] = useState("");
  const [cari, setCari] = useState("");

  const jumlahJadwal = daftar.reduce(
    (jumlah, kelas) => jumlah + kelas.jadwal.length,
    0,
  );

  const kataKunci = cari.trim().toLowerCase();
  const cocok = kataKunci
    ? daftar.filter(
        (kelas) =>
          kelas.namaKelas.toLowerCase().includes(kataKunci) ||
          kelas.cabang.toLowerCase().includes(kataKunci) ||
          kelas.guruNama.toLowerCase().includes(kataKunci),
      )
    : daftar;

  function namaMurid(muridId: string) {
    return daftarMurid.find((murid) => murid.id === muridId)?.nama ?? "Murid";
  }

  function terdaftarDi(kelasId: string): MuridDiKelas[] {
    return penempatan
      .filter((baris) => baris.kelasId === kelasId && baris.status === "aktif")
      .map((baris) => {
        const murid = daftarMurid.find((anak) => anak.id === baris.muridId);
        return murid ? { murid, tanggalMulai: baris.tanggalMulai } : undefined;
      })
      .filter((baris): baris is MuridDiKelas => baris !== undefined)
      .sort((a, b) => a.murid.nama.localeCompare(b.murid.nama, "id"));
  }

  const muridTerdaftar = new Set(
    penempatan
      .filter((baris) => baris.status === "aktif")
      .map((baris) => baris.muridId),
  );
  const muridTersedia = daftarMurid.filter(
    (murid) => !muridTerdaftar.has(murid.id),
  );

  function ubahJadwal(
    kelasId: string,
    ubah: (jadwal: JadwalKelas[]) => JadwalKelas[],
  ) {
    setDaftar((sebelumnya) =>
      sebelumnya.map((kelas) =>
        kelas.id === kelasId ? { ...kelas, jadwal: ubah(kelas.jadwal) } : kelas,
      ),
    );
  }

  function tambahKelas(kelas: Kelas) {
    setDaftar((sebelumnya) =>
      [...sebelumnya, kelas].sort((a, b) =>
        a.namaKelas.localeCompare(b.namaKelas, "id"),
      ),
    );
    setPesan(`Kelas ${kelas.namaKelas} ditambahkan.`);
  }

  function tempatkanMurid(kelasId: string, muridId: string) {
    setPenempatan((sebelumnya) => [
      ...sebelumnya,
      {
        muridId,
        kelasId,
        tanggalMulai: tanggalISO(new Date()),
        status: "aktif",
      },
    ]);
    setPesan(`${namaMurid(muridId)} ditempatkan di kelas ini.`);
  }

  function keluarkanMurid(kelasId: string, muridId: string) {
    setPenempatan((sebelumnya) =>
      sebelumnya.map((baris) =>
        baris.kelasId === kelasId && baris.muridId === muridId
          ? { ...baris, status: "selesai" }
          : baris,
      ),
    );
    setPesan(`${namaMurid(muridId)} dikeluarkan dari kelas ini.`);
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
        <KolomPencarian
          nilai={cari}
          onUbah={setCari}
          label="Cari kelas"
          placeholder="Cari nama kelas, cabang, atau guru…"
        />
        {kataKunci && (
          <p role="status" className="text-sm text-muted-foreground">
            {cocok.length} dari {daftar.length} kelas cocok dengan “
            {cari.trim()}”.
          </p>
        )}
        <FormTambahKelas onTambah={tambahKelas} />
        <p role="status" className="text-sm text-muted-foreground">
          {pesan}
        </p>
      </div>

      {cocok.length === 0 ? (
        <PesanKosong
          className="mt-6"
          judul={kataKunci ? "Tidak ada kelas yang cocok" : "Belum ada kelas"}
          keterangan={
            kataKunci
              ? `Coba kata kunci lain, atau hapus pencarian “${cari.trim()}”.`
              : "Kelas muncul di sini setelah ditambahkan."
          }
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {cocok.map((kelas) => {
            const terdaftar = terdaftarDi(kelas.id);
            return (
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
                        {terdaftar.length} murid
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
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/50 py-1 pr-1 pl-2.5 text-sm text-muted-foreground"
                        >
                          <CalendarDays
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {jadwal.hari}
                          <Clock className="ml-1 size-3.5" aria-hidden="true" />
                          {jadwal.jamMulai}–{jadwal.jamSelesai}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Hapus jadwal ${jadwal.hari} ${jadwal.jamMulai}`}
                            onClick={() =>
                              ubahJadwal(kelas.id, (jadwalLama) =>
                                jadwalLama.filter(
                                  (baris) =>
                                    !(
                                      baris.hari === jadwal.hari &&
                                      baris.jamMulai === jadwal.jamMulai
                                    ),
                                ),
                              )
                            }
                          >
                            <X aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-start gap-2">
                    <FormJadwalKelas
                      jadwalAda={kelas.jadwal}
                      onTambah={(jadwal) => {
                        ubahJadwal(kelas.id, (jadwalLama) =>
                          [...jadwalLama, jadwal].sort((a, b) =>
                            `${a.hari}${a.jamMulai}`.localeCompare(
                              `${b.hari}${b.jamMulai}`,
                              "id",
                            ),
                          ),
                        );
                        setPesan(
                          `Jadwal ${jadwal.hari} ${jadwal.jamMulai} ditambahkan ke ${kelas.namaKelas}.`,
                        );
                      }}
                    />
                    <PanelPenempatan
                      terdaftar={terdaftar}
                      tersedia={muridTersedia}
                      onTambah={(muridId) => tempatkanMurid(kelas.id, muridId)}
                      onKeluarkan={(muridId) =>
                        keluarkanMurid(kelas.id, muridId)
                      }
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Catatan: kelas, jadwal, dan penempatan murid belum tersimpan di database
        — penyimpanannya menyusul bersama API-nya.
      </p>
    </div>
  );
}
