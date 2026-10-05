// Data contoh Portal Wali (beranda).
//
// Belum ada tautan akun wali ke murid di database, jadi portal memakai daftar
// anak contoh. Bentuk datanya mengikuti kolom yang nanti dipakai: murid
// (`students`), catatan perkembangan (`student_progress`: nilai, sikap,
// catatan), dan kehadiran yang dihitung dari jurnal mengajar guru. Kehadiran
// di sini tidak disimpan, melainkan dihitung dari `getRiwayatJurnal`.

import { getRiwayatJurnal } from "@/lib/mock-jurnal";
import { tanggalISO } from "@/lib/tanggal";

export type AnakWali = {
  muridId: string;
  nama: string;
  namaOrangTua: string;
  kontakOrangTua: string;
  /** Kelas yang sedang diikuti, untuk ditampilkan di beranda. */
  kelasNama: string;
};

export type CatatanPerkembangan = {
  tanggal: string;
  nilai: number;
  sikap: string;
  catatan: string;
};

export type AnakPortal = AnakWali & {
  catatan: CatatanPerkembangan[];
  kehadiran: {
    /** Sesi yang tercatat untuk anak ini. */
    sesi: number;
    hadir: number;
    /** Tanggal sesi terakhir, atau `null` bila belum ada. */
    terakhir: string | null;
  };
};

// Satu akun wali contoh dengan dua anak supaya pemilih anak bisa dicoba.
const ANAK: AnakWali[] = [
  {
    muridId: "mrd-1",
    nama: "Aisyah Putri",
    namaOrangTua: "Bapak Hendra",
    kontakOrangTua: "0812-3456-7801",
    kelasNama: "Matematika SD Kelas 4",
  },
  {
    muridId: "mrd-7",
    nama: "Gita Permata",
    namaOrangTua: "Ibu Dewi",
    kontakOrangTua: "0878-5566-3344",
    kelasNama: "Calistung TK",
  },
];

type CatatanTersimpan = Omit<CatatanPerkembangan, "tanggal"> & {
  hariLalu: number;
};

const CATATAN: Record<string, CatatanTersimpan[]> = {
  "mrd-1": [
    {
      hariLalu: 1,
      nilai: 85,
      sikap: "A",
      catatan: "Sudah lancar penjumlahan pecahan, berani mencoba soal baru.",
    },
    {
      hariLalu: 4,
      nilai: 78,
      sikap: "B",
      catatan: "Masih perlu latihan perkalian bersusun.",
    },
    {
      hariLalu: 8,
      nilai: 90,
      sikap: "A",
      catatan: "Aktif bertanya dan membantu teman sebangku.",
    },
  ],
  "mrd-7": [
    {
      hariLalu: 3,
      nilai: 82,
      sikap: "A",
      catatan: "Mengenal huruf besar dan kecil dengan baik.",
    },
    {
      hariLalu: 10,
      nilai: 75,
      sikap: "B",
      catatan: "Perlu pendampingan saat menulis angka.",
    },
  ],
};

/**
 * Anak yang tertaut ke akun wali ini, atau `null` kalau id-nya bukan anak yang
 * tertaut. Dipakai setiap halaman portal supaya data anak lain tidak pernah
 * tersaji — nanti aturan yang sama dijalankan di sisi data (per sesi).
 */
export function anakTertaut(muridId: string | null | undefined) {
  return getAnakPortal().find((baris) => baris.muridId === muridId) ?? null;
}

/**
 * Anak yang diminta lewat alamat halaman; kalau id-nya bukan anak yang tertaut,
 * kembali ke anak pertama (atau `null` bila akun belum punya anak).
 */
export function anakTertautAtauPertama(muridId?: string | null) {
  const anak = getAnakPortal();
  return anak.find((baris) => baris.muridId === muridId) ?? anak[0] ?? null;
}

/** Anak yang tertaut ke akun wali contoh, lengkap catatan dan kehadirannya. */
export function getAnakPortal(): AnakPortal[] {
  const jurnal = getRiwayatJurnal();
  const hariIni = new Date();

  return ANAK.map((anak) => {
    const sesi = jurnal
      .map((catatan) => ({
        tanggal: catatan.tanggal,
        murid: catatan.murid.find((baris) => baris.id === anak.muridId),
      }))
      .filter((baris) => baris.murid);
    const hadir = sesi.filter((baris) => baris.murid?.hadir).length;
    const tanggalSesi = sesi
      .map((baris) => baris.tanggal)
      .sort((a, b) => b.localeCompare(a));

    return {
      ...anak,
      catatan: (CATATAN[anak.muridId] ?? []).map(({ hariLalu, ...baris }) => {
        const tanggal = new Date(hariIni);
        tanggal.setDate(tanggal.getDate() - hariLalu);
        return { ...baris, tanggal: tanggalISO(tanggal) };
      }),
      kehadiran: {
        sesi: sesi.length,
        hadir,
        terakhir: tanggalSesi[0] ?? null,
      },
    };
  });
}
