"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { IsianTeks } from "@/components/isian-form";
import { formatRupiah } from "@/lib/gaji";
import {
  buatTagihanBaru,
  langgananTagihan,
  siapkanTagihan,
  snapshotTagihan,
} from "@/lib/tagihan-store";
import { formatPeriodeTagihan } from "@/lib/tagihan";

type MuridDitagih = {
  id: string;
  nama: string;
  namaOrangTua: string;
  kelasNama: string;
};

type FormTagihanBulananProps = {
  murid: MuridDitagih[];
  kelasTersedia: string[];
};

const NAMA_BULAN = new Intl.DateTimeFormat("id-ID", { month: "long" });
const bulanTampil = (bulan: number) =>
  NAMA_BULAN.format(new Date(2026, bulan - 1, 1));

const bulanSekarang = new Date();

/**
 * Formulir buat tagihan bulanan: pilih periode dan nominal, centang murid yang
 * ditagih (satu atau sekaligus banyak), lalu simpan. Murid yang sudah punya
 * tagihan pada periode itu tidak bisa dicentang lagi supaya tagihannya tidak
 * ganda. Datanya masih tiruan dan disimpan selama aplikasi terbuka.
 */
export function FormTagihanBulanan({
  murid,
  kelasTersedia,
}: FormTagihanBulananProps) {
  const semua = useSyncExternalStore(
    langgananTagihan,
    snapshotTagihan,
    snapshotTagihan,
  );

  const [bulan, setBulan] = useState(bulanSekarang.getMonth() + 1);
  const [tahun, setTahun] = useState(bulanSekarang.getFullYear());
  const [nominal, setNominal] = useState("400000");
  const [kelas, setKelas] = useState("");
  const [dipilih, setDipilih] = useState<string[]>([]);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    siapkanTagihan();
  }, []);

  const periode = `${tahun}-${String(bulan).padStart(2, "0")}`;

  const sudahDitagih = useMemo(
    () =>
      new Set(
        semua
          .filter(
            (baris) =>
              baris.periodeBulan === bulan && baris.periodeTahun === tahun,
          )
          .map((baris) => baris.muridId),
      ),
    [semua, bulan, tahun],
  );

  const daftarMurid = useMemo(
    () => murid.filter((anak) => !kelas || anak.kelasNama === kelas),
    [murid, kelas],
  );

  const nominalAngka = Number(nominal);
  const nominalSah =
    nominal.trim() !== "" && Number.isFinite(nominalAngka) && nominalAngka > 0;
  const terpilih = daftarMurid.filter((anak) => dipilih.includes(anak.id));

  function simpan() {
    if (terpilih.length === 0) {
      setGalat("Pilih minimal satu murid yang akan ditagih.");
      return;
    }
    if (!nominalSah) {
      setGalat("Nominal tagihan harus angka lebih dari nol.");
      return;
    }

    const hasil = buatTagihanBaru(periode, Math.round(nominalAngka), terpilih);
    const bagian = [
      `${hasil.dibuat} tagihan ${formatPeriodeTagihan(periode)} dibuat`,
      `nominal ${formatRupiah(Math.round(nominalAngka))}`,
    ];
    if (hasil.dilewati.length > 0) {
      bagian.push(
        `dilewati karena sudah ditagih: ${hasil.dilewati.join(", ")}`,
      );
    }
    setPesan(`${bagian.join(" · ")}.`);
    setGalat("");
    setDipilih([]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Periode dan Nominal</CardTitle>
          <CardDescription>
            Tagihan berlaku untuk bulan yang dipilih, dengan nominal yang sama
            untuk semua murid yang dicentang.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bulan">Bulan</Label>
            <NativeSelect
              id="bulan"
              value={bulan}
              onChange={(event) => setBulan(Number(event.target.value))}
            >
              {Array.from({ length: 12 }, (_, urutan) => urutan + 1).map(
                (nilai) => (
                  <option key={nilai} value={nilai}>
                    {bulanTampil(nilai)}
                  </option>
                ),
              )}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tahun">Tahun</Label>
            <NativeSelect
              id="tahun"
              value={tahun}
              onChange={(event) => setTahun(Number(event.target.value))}
            >
              {[0, -1, -2].map((geser) => {
                const nilai = bulanSekarang.getFullYear() + geser;
                return (
                  <option key={nilai} value={nilai}>
                    {nilai}
                  </option>
                );
              })}
            </NativeSelect>
          </div>
          <IsianTeks
            id="nominal"
            label="Nominal per murid"
            type="number"
            min={0}
            step={1000}
            inputMode="numeric"
            value={nominal}
            onChange={(event) => setNominal(event.target.value)}
            keterangan="Rupiah, tanpa titik. Contoh: 400000."
            error={galat && !nominalSah ? galat : undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4" aria-hidden="true" />
            Murid yang Ditagih
          </CardTitle>
          <CardDescription>
            {semua.length > 0
              ? `Centang satu murid atau sekaligus banyak untuk ${formatPeriodeTagihan(periode)}. Murid bertanda "sudah ditagih" tidak bisa dicentang.`
              : "Belum ada murid aktif yang bisa ditagih."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {kelasTersedia.length > 0 && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="saring-kelas">Saring kelas</Label>
              <NativeSelect
                id="saring-kelas"
                value={kelas}
                onChange={(event) => setKelas(event.target.value)}
              >
                <option value="">Semua kelas</option>
                {kelasTersedia.map((nama) => (
                  <option key={nama} value={nama}>
                    {nama}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <ul className="space-y-2">
            {daftarMurid.map((anak) => {
              const sudah = sudahDitagih.has(anak.id);
              const centang = dipilih.includes(anak.id);
              return (
                <li
                  key={anak.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <Checkbox
                    id={`tagih-${anak.id}`}
                    checked={centang}
                    disabled={sudah}
                    onCheckedChange={(nilai) =>
                      setDipilih((sebelumnya) =>
                        nilai === true
                          ? [...sebelumnya, anak.id]
                          : sebelumnya.filter((id) => id !== anak.id),
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`tagih-${anak.id}`}>{anak.nama}</Label>
                    <p className="truncate text-xs text-muted-foreground">
                      {anak.kelasNama}
                      {anak.namaOrangTua ? ` · wali: ${anak.namaOrangTua}` : ""}
                    </p>
                  </div>
                  {sudah && (
                    <span className="rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                      Sudah ditagih
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            {terpilih.length > 0
              ? `${terpilih.length} murid dipilih · total ${formatRupiah(
                  terpilih.length * Math.max(0, Math.round(nominalAngka) || 0),
                )} untuk ${formatPeriodeTagihan(periode)}.`
              : "Belum ada murid yang dicentang."}
          </p>

          {galat && (
            <p role="alert" className="text-sm text-destructive">
              {galat}
            </p>
          )}
          <p role="status" className="text-sm text-muted-foreground">
            {pesan}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={terpilih.length === 0 || !nominalSah}
              onClick={simpan}
            >
              <CalendarPlus aria-hidden="true" />
              Buat tagihan
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/tagihan">
                Lihat daftar tagihan
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>

          {pesan && (
            <p className="flex items-center gap-1.5 text-sm text-primary">
              <Check className="size-4" aria-hidden="true" />
              Tagihan tersimpan di daftar (masih data tiruan).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
