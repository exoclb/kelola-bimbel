"use client";

import { useId, useState } from "react";
import { CheckCircle2, ShieldCheck, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KolomPencarian } from "@/components/kolom-pencarian";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { AkunMasuk } from "@/lib/mock-akun";
import { labelPeran } from "@/lib/peran";

type SaringanStatus = "semua" | "aktif" | "nonaktif";

type DaftarGuruProps = {
  daftarAwal: AkunMasuk[];
};

/**
 * Daftar akun guru dan owner: pencarian, saringan status, dan tombol untuk
 * menonaktifkan atau mengaktifkan kembali. Datanya masih tiruan — perubahannya
 * baru berlaku di layar (lihat src/lib/mock-pengaturan.ts).
 */
export function DaftarGuru({ daftarAwal }: DaftarGuruProps) {
  const idSaring = useId();
  const [daftar, setDaftar] = useState<AkunMasuk[]>(daftarAwal);
  const [cari, setCari] = useState("");
  const [saringan, setSaringan] = useState<SaringanStatus>("semua");
  const [pesan, setPesan] = useState("");

  const kataKunci = cari.trim().toLowerCase();
  const hasil = daftar.filter((akun) => {
    const cocokCari =
      kataKunci.length === 0 ||
      akun.nama.toLowerCase().includes(kataKunci) ||
      akun.email.toLowerCase().includes(kataKunci) ||
      akun.cabang.toLowerCase().includes(kataKunci);
    const cocokStatus =
      saringan === "semua" ||
      (saringan === "aktif" ? akun.statusAktif : !akun.statusAktif);
    return cocokCari && cocokStatus;
  });

  const jumlahAktif = daftar.filter((akun) => akun.statusAktif).length;

  function ubahStatus(akun: AkunMasuk) {
    const jadiAktif = !akun.statusAktif;
    setDaftar((sebelumnya) =>
      sebelumnya.map((baris) =>
        baris.id === akun.id ? { ...baris, statusAktif: jadiAktif } : baris,
      ),
    );
    setPesan(
      jadiAktif
        ? `${akun.nama} diaktifkan lagi di layar ini — perubahannya belum dikirim ke server.`
        : `${akun.nama} dinonaktifkan di layar ini — perubahannya belum dikirim ke server.`,
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kelola Guru</CardTitle>
        <CardDescription>
          {jumlahAktif} dari {daftar.length} akun aktif. Guru yang dinonaktifkan
          tidak bisa masuk lagi, tetapi catatan dan jurnalnya tetap tersimpan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
          <KolomPencarian
            nilai={cari}
            onUbah={setCari}
            label="Cari guru"
            placeholder="Cari nama, email, atau cabang…"
          />
          <div className="space-y-2">
            <Label htmlFor={idSaring}>Status</Label>
            <NativeSelect
              id={idSaring}
              value={saringan}
              onChange={(event) =>
                setSaringan(event.target.value as SaringanStatus)
              }
            >
              <option value="semua">Semua akun</option>
              <option value="aktif">Hanya yang aktif</option>
              <option value="nonaktif">Hanya yang nonaktif</option>
            </NativeSelect>
          </div>
        </div>

        {pesan && (
          <p
            role="status"
            className="inline-flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6"
          >
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            {pesan}
          </p>
        )}

        {hasil.length === 0 ? (
          <p className="rounded-lg border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada akun yang cocok dengan pencarian atau saringannya.
          </p>
        ) : (
          <ul className="space-y-3">
            {hasil.map((akun) => (
              <li
                key={akun.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{akun.nama}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {akun.email} · {akun.cabang}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium">
                    {labelPeran(akun.peran)}
                  </span>
                  <span
                    className={
                      akun.statusAktif
                        ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        : "rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                    }
                  >
                    {akun.statusAktif ? "Aktif" : "Nonaktif"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => ubahStatus(akun)}
                  >
                    {akun.statusAktif ? (
                      <>
                        <UserRoundX aria-hidden="true" />
                        Nonaktifkan
                      </>
                    ) : (
                      <>
                        <ShieldCheck aria-hidden="true" />
                        Aktifkan
                      </>
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
