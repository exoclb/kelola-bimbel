// Data contoh Portal Wali (beranda).
//
// Anak yang tampil di portal diambil dari penautan akun wali ke murid
// (`mock-wali.ts`), jadi daftar di portal tidak berbeda dengan daftar penautan
// yang dilihat owner. Bentuk datanya mengikuti kolom yang nanti dipakai: murid
// (`students`), catatan perkembangan (`student_progress`: nilai, sikap,
// catatan). Kehadiran tidak disimpan di sini, melainkan dihitung dari
// `getRiwayatJurnal`.

import { getRiwayatJurnal } from "@/lib/mock-jurnal";
import { getDaftarMurid } from "@/lib/mock-murid";
import { getWali, WALI_PORTAL } from "@/lib/mock-wali";
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

type CatatanTersimpan = Omit<CatatanPerkembangan, "tanggal"> & {
  hariLalu: number;
};

const CATATAN: Record<string, CatatanTersimpan[]> = {
  "mrd-2": [
    {
      hariLalu: 2,
      nilai: 84,
      sikap: "A",
      catatan: "Sudah berani bercakap sederhana, pelafalannya jelas.",
    },
    {
      hariLalu: 6,
      nilai: 76,
      sikap: "B",
      catatan: "Perlu menambah kosakata kerja bentuk lampau.",
    },
    {
      hariLalu: 12,
      nilai: 88,
      sikap: "A",
      catatan: "Mengumpulkan tugas tepat waktu dan aktif bertanya.",
    },
  ],
  "mrd-8": [
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

/** Anak yang tertaut ke akun wali contoh, lengkap catatan dan kehadirannya. */
export function getAnakPortal(): AnakPortal[] {
  const wali = getWali(WALI_PORTAL);
  if (!wali) return [];

  const murid = new Map(getDaftarMurid().map((anak) => [anak.id, anak]));
  const jurnal = getRiwayatJurnal();
  const hariIni = new Date();

  return wali.murid.map((tautan) => {
    const anak = murid.get(tautan.muridId);
    const sesi = jurnal
      .map((catatan) => ({
        tanggal: catatan.tanggal,
        murid: catatan.murid.find((baris) => baris.id === tautan.muridId),
      }))
      .filter((baris) => baris.murid);
    const hadir = sesi.filter((baris) => baris.murid?.hadir).length;
    const tanggalSesi = sesi
      .map((baris) => baris.tanggal)
      .sort((a, b) => b.localeCompare(a));

    return {
      muridId: tautan.muridId,
      nama: tautan.nama,
      namaOrangTua: anak?.namaOrangTua ?? wali.nama,
      kontakOrangTua: anak?.kontakOrangTua ?? wali.kontak,
      kelasNama: tautan.kelasNama,
      catatan: (CATATAN[tautan.muridId] ?? []).map(({ hariLalu, ...baris }) => {
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
