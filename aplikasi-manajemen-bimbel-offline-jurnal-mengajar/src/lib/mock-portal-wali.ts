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
import { getSemuaTagihan } from "@/lib/mock-tagihan";
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

/** Bagian portal yang punya penanda "baru" sendiri. */
export const BAGIAN_PORTAL = ["kehadiran", "perkembangan", "tagihan"] as const;

export type BagianPortal = (typeof BAGIAN_PORTAL)[number];

/** Keadaan satu bagian anak: kapan isinya berubah dan kapan terakhir dibaca. */
export type WaktuBagian = {
  /** Tanggal (`YYYY-MM-DD`) isi bagian ini terakhir berubah, `null` bila kosong. */
  terbaru: string | null;
  /** Tanggal baca terakhir menurut data tiruan, `null` bila belum pernah dibaca. */
  terakhirDibaca: string | null;
};

/**
 * Status baca satu bagian anak: `WaktuBagian` ditambah kesimpulan "baru" dan
 * penanda apakah wali ini sendiri pernah menandainya terbaca. Bentuk inilah
 * yang dikirim `GET/POST /api/jejak-baca` dan diteruskan halaman portal sebagai
 * prop, jadi tampilan tidak pernah menghitung statusnya sendiri.
 */
export type StatusBagianPortal = WaktuBagian & {
  /** Bagian dianggap baru bila isinya lebih baru daripada `terakhirDibaca`. */
  baru: boolean;
  /** Wali ini sudah pernah menandai bagian ini terbaca (bukan bawaan data tiruan). */
  tercatat: boolean;
};

/** Status ketiga bagian satu anak. */
export type StatusJejakAnak = Record<BagianPortal, StatusBagianPortal>;

/** Status tiap anak yang tertaut ke akun wali, berkunci `muridId`. */
export type StatusJejakPortal = Record<string, StatusJejakAnak>;

export type AnakPortal = AnakWali & {
  catatan: CatatanPerkembangan[];
  kehadiran: {
    /** Sesi yang tercatat untuk anak ini. */
    sesi: number;
    hadir: number;
    /** Tanggal sesi terakhir, atau `null` bila belum ada. */
    terakhir: string | null;
  };
  /** Waktu isi & baca tiap bagian, dasar penanda "baru" di portal. */
  bagian: Record<BagianPortal, WaktuBagian>;
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
    {
      hariLalu: 21,
      nilai: 72,
      sikap: "C",
      catatan: "Beberapa kali tidak mengerjakan latihan rumah.",
    },
    {
      hariLalu: 33,
      nilai: 80,
      sikap: "B",
      catatan: "Sudah bisa menyusun kalimat tanya sederhana.",
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
    {
      hariLalu: 19,
      nilai: 79,
      sikap: "B",
      catatan: "Sudah hafal urutan angka 1–20.",
    },
    {
      hariLalu: 31,
      nilai: 85,
      sikap: "A",
      catatan: "Antusias mengikuti kegiatan mewarnai dan menulis.",
    },
  ],
};

/** Tanggal (`YYYY-MM-DD`) beberapa hari sebelum hari ini. */
function tanggalHariLalu(hariLalu: number) {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() - hariLalu);
  return tanggalISO(tanggal);
}

/** Tanggal baca bawaan, atau `null` kalau bagiannya belum pernah dibaca. */
function tanggalDibaca(hariLalu: number | undefined) {
  return hariLalu === undefined ? null : tanggalHariLalu(hariLalu);
}

// Tanggal baca terakhir menurut data tiruan, dalam "berapa hari lalu"
// (0 = hari ini). Bagian yang tidak terdaftar berarti belum pernah dibaca.
//
// Aturan penanda "baru": satu bagian bertanda "baru" kalau isinya lebih baru
// daripada tanggal baca terakhir. Jadi `mrd-2` bertanda "baru" pada kehadiran,
// catatan perkembangan, dan tagihan (catatan terbaru 2 hari lalu padahal
// terakhir dibaca 5 hari lalu), sedangkan `mrd-8` hanya pada tagihan karena
// kehadiran dan catatannya sudah dibaca setelah isinya berubah.
const TERAKHIR_DIBACA: Record<string, Partial<Record<BagianPortal, number>>> = {
  "mrd-2": { kehadiran: 1, perkembangan: 5, tagihan: 10 },
  "mrd-8": { kehadiran: 2, perkembangan: 1 },
};

/** Anak yang tertaut ke akun wali contoh, lengkap catatan dan kehadirannya. */
export function getAnakPortal(): AnakPortal[] {
  const wali = getWali(WALI_PORTAL);
  if (!wali) return [];

  const murid = new Map(getDaftarMurid().map((anak) => [anak.id, anak]));
  const jurnal = getRiwayatJurnal();
  const tagihan = getSemuaTagihan();
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
    const catatan = (CATATAN[tautan.muridId] ?? []).map(
      ({ hariLalu, ...baris }) => {
        const tanggal = new Date(hariIni);
        tanggal.setDate(tanggal.getDate() - hariLalu);
        return { ...baris, tanggal: tanggalISO(tanggal) };
      },
    );
    // Tagihan dianggap berubah saat diterbitkan atau saat dibayar, jadi
    // tanggal terbarunya diambil dari kedua kolom itu.
    const tanggalTagihan =
      tagihan
        .filter((baris) => baris.muridId === tautan.muridId)
        .flatMap((baris) => [baris.dibuatPada.slice(0, 10), baris.tanggalBayar])
        .filter((nilai): nilai is string => Boolean(nilai))
        .sort((a, b) => b.localeCompare(a))[0] ?? null;
    const dibaca = TERAKHIR_DIBACA[tautan.muridId] ?? {};

    return {
      muridId: tautan.muridId,
      nama: tautan.nama,
      namaOrangTua: anak?.namaOrangTua ?? wali.nama,
      kontakOrangTua: anak?.kontakOrangTua ?? wali.kontak,
      kelasNama: tautan.kelasNama,
      catatan,
      kehadiran: {
        sesi: sesi.length,
        hadir,
        terakhir: tanggalSesi[0] ?? null,
      },
      bagian: {
        kehadiran: {
          terbaru: tanggalSesi[0] ?? null,
          terakhirDibaca: tanggalDibaca(dibaca.kehadiran),
        },
        perkembangan: {
          terbaru: catatan[0]?.tanggal ?? null,
          terakhirDibaca: tanggalDibaca(dibaca.perkembangan),
        },
        tagihan: {
          terbaru: tanggalTagihan,
          terakhirDibaca: tanggalDibaca(dibaca.tagihan),
        },
      },
    };
  });
}

/**
 * Waktu isi & baca terakhir satu bagian anak — sumber tiruan penanda "baru".
 * Fase berikutnya cukup mengganti isi fungsi ini dengan query per sesi wali,
 * tanpa mengubah tampilan.
 */
export function waktuBagian(
  muridId: string,
  bagian: BagianPortal,
): WaktuBagian | null {
  const anak = getAnakPortal().find((baris) => baris.muridId === muridId);
  return anak?.bagian[bagian] ?? null;
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
