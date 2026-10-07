"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IsianPilih, IsianTeks } from "@/components/isian-form";
import {
  langgananCabang,
  siapkanCabang,
  snapshotCabang,
} from "@/lib/cabang-store";
import { GURU_KELAS, type Kelas } from "@/lib/mock-kelas";

type FormUbahKelasProps = {
  kelas: Kelas;
  onSimpan: (perubahan: {
    namaKelas: string;
    cabang: string;
    guruNama: string;
  }) => void;
  onBatal: () => void;
};

type Galat = { namaKelas?: string; cabang?: string };

/**
 * Formulir ubah data kelas: nama, cabang, dan guru pengampu. Pilihan cabangnya
 * mengikuti data cabang, tetapi hanya cabang aktif yang ditawarkan untuk
 * pemindahan. Jadwal tidak diubah di sini — jadwal punya formulirnya sendiri
 * supaya penjagaan bentrok jam tetap di satu tempat.
 */
export function FormUbahKelas({
  kelas,
  onSimpan,
  onBatal,
}: FormUbahKelasProps) {
  // Pilihan cabang ikut data cabang di halaman /app/cabang. Untuk formulir
  // ubah, cabang nonaktif tidak ditawarkan lagi sebagai tujuan baru, tetapi
  // cabang kelas yang sedang dibuka tetap disertakan (ditandai nonaktif) agar
  // menyimpan perubahan lain tidak diam-diam memindahkan kelasnya.
  const daftarCabang = useSyncExternalStore(
    langgananCabang,
    snapshotCabang,
    snapshotCabang,
  );
  const pilihanCabang = useMemo(
    () => daftarCabang.filter((baris) => baris.statusAktif),
    [daftarCabang],
  );
  const cabangSaatIni = daftarCabang.find(
    (baris) => baris.nama === kelas.cabang,
  );
  const adaOpsiSaatIni = pilihanCabang.some(
    (baris) => baris.nama === kelas.cabang,
  );

  const [namaKelas, setNamaKelas] = useState(kelas.namaKelas);
  const [cabang, setCabang] = useState(kelas.cabang);
  const [guruNama, setGuruNama] = useState(kelas.guruNama);
  const [galat, setGalat] = useState<Galat>({});

  useEffect(() => {
    siapkanCabang();
  }, []);

  function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaRapi = namaKelas.trim();
    const cabangRapi = cabang.trim();
    const masalah: Galat = {};
    if (!namaRapi) masalah.namaKelas = "Nama kelas wajib diisi.";
    if (!cabangRapi) masalah.cabang = "Cabang wajib diisi.";

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    onSimpan({ namaKelas: namaRapi, cabang: cabangRapi, guruNama });
  }

  return (
    <form
      onSubmit={simpan}
      className="mt-4 space-y-3 rounded-xl border bg-muted/40 px-4 py-3"
      noValidate
    >
      <p className="text-sm font-medium">Ubah data kelas</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <IsianTeks
          id={`ubah-${kelas.id}-nama`}
          label="Nama kelas"
          value={namaKelas}
          maxLength={120}
          required
          error={galat.namaKelas}
          onChange={(event) => {
            setNamaKelas(event.target.value);
            setGalat((sebelumnya) => ({ ...sebelumnya, namaKelas: undefined }));
          }}
        />
        <IsianPilih
          id={`ubah-${kelas.id}-cabang`}
          label="Cabang"
          value={cabang}
          required
          error={galat.cabang}
          keterangan="Cabang nonaktif tidak ditawarkan untuk pemindahan baru."
          onChange={(event) => {
            setCabang(event.target.value);
            setGalat((sebelumnya) => ({ ...sebelumnya, cabang: undefined }));
          }}
        >
          {!adaOpsiSaatIni && (
            <option value={kelas.cabang}>
              {kelas.cabang}
              {cabangSaatIni && !cabangSaatIni.statusAktif ? " (nonaktif)" : ""}
            </option>
          )}
          {pilihanCabang.map((baris) => (
            <option key={baris.id} value={baris.nama}>
              {baris.nama}
            </option>
          ))}
        </IsianPilih>
        <IsianPilih
          id={`ubah-${kelas.id}-guru`}
          label="Guru pengampu"
          value={guruNama}
          onChange={(event) => setGuruNama(event.target.value)}
        >
          {[...new Set([...GURU_KELAS, kelas.guruNama])].map((nama) => (
            <option key={nama} value={nama}>
              {nama}
            </option>
          ))}
        </IsianPilih>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          <Check aria-hidden="true" />
          Simpan perubahan
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onBatal}>
          <X aria-hidden="true" />
          Batal
        </Button>
      </div>
    </form>
  );
}
