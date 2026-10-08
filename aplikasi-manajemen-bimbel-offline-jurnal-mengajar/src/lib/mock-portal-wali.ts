// Isi contoh Portal Wali.
//
// Anak yang tampil di portal bukan dari sini: daftar anak diambil dari basis
// data per sesi wali (`src/services/portal.service.ts`, `wali_murid` →
// `students`). Modul ini hanya menyediakan **isi tiruan per anak** — catatan
// perkembangan, rekap kehadiran dari jurnal, dan waktu isi tiap bagian yang
// jadi dasar penanda "baru" — beserta tipe yang dipakai bersama tampilan.
//
// Yang masih tiruan: catatan perkembangan, tagihan, dan jurnal (belum ada
// sumber basis datanya), jadi isi anak dibaca dari modul tiruan yang sama
// dengan yang dipakai owner. Yang sudah dari basis data: identitas anak (nama,
// orang tua, status aktif, kelas dari penempatan). Kelas sengaja tidak diambil
// dari sini — kalau tabel kelas/penempatan kosong, kelasnya `null`, bukan nama
// karangan.
//
// Setiap anak membawa dua penamaan id (lihat `src/lib/id-murid.mjs`):
// `muridId` adalah id basis data (`students.id`) yang dipakai portal di alamat
// halaman dan dikirim ke `/api/jejak-baca` supaya cocok dengan
// `wali_murid.murid_id`, sedangkan `sumberTiruan` adalah id data contoh
// (`mrd-N`) yang jadi kunci catatan, tagihan, dan jurnal tiruan.

import { getRiwayatJurnal } from "@/lib/mock-jurnal";
import { getSemuaTagihan } from "@/lib/mock-tagihan";
import { tanggalISO } from "@/lib/tanggal";

export type AnakWali = {
  /** Id basis data murid (`students.id`): dipakai alamat portal dan API. */
  muridId: string;
  /**
   * Id anak pada data tiruan (`mrd-N`): kunci catatan, tagihan, dan jurnal.
   * `null` bila anaknya tidak berasal dari data tiruan (tanpa isi tiruan).
   */
  sumberTiruan: string | null;
  nama: string;
  /** Nama orang tua dari `students`; string kosong bila kolomnya kosong. */
  namaOrangTua: string;
  /** Kontak orang tua dari `students`; string kosong bila kolomnya kosong. */
  kontakOrangTua: string;
  /** Kelas yang sedang diikuti dari penempatan murid; `null` bila belum ada. */
  kelasNama: string | null;
  /** Status murid (`students.status_aktif`). */
  statusAktif: boolean;
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

/** Isi tiruan satu anak (tanpa identitas, yang sudah datang dari basis data). */
export type IsiAnakTiruan = Pick<
  AnakPortal,
  "catatan" | "kehadiran" | "bagian"
>;

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

/** Isi anak tanpa data tiruan: tidak ada catatan, sesi, maupun tanggal isi. */
const ISI_KOSONG: IsiAnakTiruan = {
  catatan: [],
  kehadiran: { sesi: 0, hadir: 0, terakhir: null },
  bagian: {
    kehadiran: { terbaru: null, terakhirDibaca: null },
    perkembangan: { terbaru: null, terakhirDibaca: null },
    tagihan: { terbaru: null, terakhirDibaca: null },
  },
};

/**
 * Isi tiruan satu anak: catatan perkembangan, rekap kehadiran dari jurnal, dan
 * waktu isi tiap bagian (dasar penanda "baru"). Anak tanpa padanan data tiruan
 * (`sumberTiruan` `null`) mendapat isi kosong, bukan galat — jadi anak basis
 * data yang belum punya contoh tetap tampil dengan keadaan kosong yang jujur.
 */
export function isiAnakTiruan(sumberTiruan: string | null): IsiAnakTiruan {
  if (!sumberTiruan) return ISI_KOSONG;

  const jurnal = getRiwayatJurnal();
  const tagihan = getSemuaTagihan();
  const hariIni = new Date();

  const sesi = jurnal
    .map((catatan) => ({
      tanggal: catatan.tanggal,
      murid: catatan.murid.find((baris) => baris.id === sumberTiruan),
    }))
    .filter((baris) => baris.murid);
  const hadir = sesi.filter((baris) => baris.murid?.hadir).length;
  const tanggalSesi = sesi
    .map((baris) => baris.tanggal)
    .sort((a, b) => b.localeCompare(a));
  const catatan = (CATATAN[sumberTiruan] ?? []).map(
    ({ hariLalu, ...baris }) => {
      const tanggal = new Date(hariIni);
      tanggal.setDate(tanggal.getDate() - hariLalu);
      return { ...baris, tanggal: tanggalISO(tanggal) };
    },
  );
  // Tagihan dianggap berubah saat diterbitkan atau saat dibayar, jadi tanggal
  // terbarunya diambil dari kedua kolom itu.
  const tanggalTagihan =
    tagihan
      .filter((baris) => baris.muridId === sumberTiruan)
      .flatMap((baris) => [baris.dibuatPada.slice(0, 10), baris.tanggalBayar])
      .filter((nilai): nilai is string => Boolean(nilai))
      .sort((a, b) => b.localeCompare(a))[0] ?? null;
  const dibaca = TERAKHIR_DIBACA[sumberTiruan] ?? {};

  return {
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
}
