// Bentuk data Portal Wali yang dipakai bersama layanan server dan tampilan.
//
// Modul ini murni tipe — tidak ada data contoh maupun kueri. Seluruh isinya
// datang dari basis data: identitas anak dari `wali_murid` → `students`
// (portal.service), catatan perkembangan dari `student_progress`
// (perkembangan.service), kehadiran dari `journal_attendances` →
// `teaching_journals` (kehadiran.service), tagihan dari `student_invoices`
// (tagihan.service), dan waktu baca dari `jejak_baca_portal`
// (jejak-baca.service).

import type { NamaHari } from "@/lib/tanggal";

export type AnakWali = {
  /** Id basis data murid (`students.id`): dipakai alamat portal dan API. */
  muridId: string;
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

/** Satu catatan perkembangan anak seperti yang ditampilkan ke wali. */
export type CatatanPerkembangan = {
  id: string;
  tanggal: string;
  nilai: number;
  sikap: string;
  catatan: string;
  guruNama: string;
};

/** Satu sesi jurnal yang mencatat kehadiran anak. */
export type SesiKehadiran = {
  jurnalId: string;
  tanggal: string;
  kelasNama: string;
  guruNama: string;
  hadir: boolean;
  catatan: string;
};

/** Satu jadwal belajar satu anak: kelasnya, jamnya, dan guru pengajarnya. */
export type JadwalAnak = {
  jadwalId: string;
  muridId: string;
  kelasNama: string;
  cabang: string;
  guruNama: string;
  hari: NamaHari;
  /** Jam dalam bentuk `HH:MM`. */
  jamMulai: string;
  jamSelesai: string;
};

/** Bagian portal yang punya penanda "baru" sendiri. */
export const BAGIAN_PORTAL = ["kehadiran", "perkembangan", "tagihan"] as const;
export type BagianPortal = (typeof BAGIAN_PORTAL)[number];

/**
 * Kapan isi satu bagian terakhir berubah, dihitung dari basis data:
 * - `kehadiran` dari tanggal sesi jurnal terakhir anak,
 * - `perkembangan` dari tanggal catatan perkembangan terakhir anak,
 * - `tagihan` dari tanggal tagihan diterbitkan atau dibayar, mana yang terbaru.
 *
 * Nilai `terbaru` inilah yang dibandingkan dengan waktu baca wali untuk
 * menyimpulkan penanda "baru".
 */
export type WaktuBagian = {
  /** Tanggal (`YYYY-MM-DD`) isi terbaru bagian ini, `null` bila masih kosong. */
  terbaru: string | null;
};

/**
 * Status baca satu bagian anak: waktu isi dari basis data, waktu baca terakhir
 * wali ini dari `jejak_baca_portal`, dan kesimpulan "baru". Bentuk inilah yang
 * dikirim `GET/POST /api/jejak-baca` dan diteruskan halaman portal sebagai
 * prop, jadi tampilan tidak pernah menghitung statusnya sendiri.
 */
export type StatusBagianPortal = WaktuBagian & {
  /** Tanggal baca terakhir wali ini (`YYYY-MM-DD`), `null` bila belum dibaca. */
  terakhirDibaca: string | null;
  /** Isi lebih baru daripada waktu baca, atau belum pernah dibaca sama sekali. */
  baru: boolean;
  /** Wali ini sudah punya catatan baca tersimpan untuk bagian ini. */
  tercatat: boolean;
};

/** Status ketiga bagian satu anak. */
export type StatusJejakAnak = Record<BagianPortal, StatusBagianPortal>;

/** Status tiap anak yang tertaut ke akun wali, berkunci `muridId`. */
export type StatusJejakPortal = Record<string, StatusJejakAnak>;

/** Isi satu anak (tanpa identitas) yang ditampilkan portal. */
export type AnakPortal = AnakWali & {
  /** Riwayat catatan perkembangan anak, terbaru lebih dulu. */
  catatan: CatatanPerkembangan[];
  kehadiran: {
    /** Sesi yang tercatat untuk anak ini. */
    sesi: number;
    hadir: number;
    /** Tanggal sesi terakhir, atau `null` bila belum ada. */
    terakhir: string | null;
    /** Rincian tiap sesi, terbaru lebih dulu. */
    daftar: SesiKehadiran[];
  };
  /** Waktu isi tiap bagian, dasar penanda "baru" di portal. */
  bagian: Record<BagianPortal, WaktuBagian>;
};
