// Data contoh akun wali dan penautannya ke murid.
//
// Tabel penautan wali–murid belum ada, dan halaman pengaturan masih memakai
// data tiruan. Bentuk datanya mengikuti rencana kolomnya: akun wali memakai
// tabel `user` (nama, email, peran `orang-tua`) dan penautannya menyimpan
// sepasang (akun wali, murid). Portal wali memakai daftar yang sama supaya
// anak yang tampil di portal tidak berbeda dengan yang tertaut di sini.

import { getDaftarMurid } from "@/lib/mock-murid";

export type WaliMurid = {
  muridId: string;
  nama: string;
  /** Kelas yang sedang diikuti, untuk keterangan di daftar penautan. */
  kelasNama: string;
};

export type AkunWali = {
  waliId: string;
  nama: string;
  email: string;
  kontak: string;
  murid: WaliMurid[];
};

/** Akun wali yang jadi contoh portal: satu akun dengan dua anak. */
export const WALI_PORTAL = "wali-1";

type PenautanTersimpan = {
  waliId: string;
  nama: string;
  email: string;
  kontak: string;
  muridIds: string[];
};

// Satu akun boleh tertaut ke lebih dari satu murid (mis. dua anak sekaligus),
// dan akun yang belum tertaut ke siapa pun tetap terdaftar di sini supaya
// owner bisa melihatnya.
const PENAUTAN: PenautanTersimpan[] = [
  {
    waliId: "wali-1",
    nama: "Ibu Ratna",
    email: "ratna.wali@kelolabimbel.test",
    kontak: "0813-2211-4455",
    muridIds: ["mrd-2", "mrd-8"],
  },
  {
    waliId: "wali-2",
    nama: "Bapak Hendra",
    email: "hendra.wali@kelolabimbel.test",
    kontak: "0812-3456-7801",
    muridIds: ["mrd-1"],
  },
  {
    waliId: "wali-3",
    nama: "Ibu Melati",
    email: "melati.wali@kelolabimbel.test",
    kontak: "0857-9900-1122",
    muridIds: ["mrd-3"],
  },
  {
    waliId: "wali-4",
    nama: "Bapak Yusuf",
    email: "yusuf.wali@kelolabimbel.test",
    kontak: "0821-4455-6677",
    muridIds: ["mrd-4"],
  },
  {
    waliId: "wali-5",
    nama: "Ibu Dewi",
    email: "dewi.wali@kelolabimbel.test",
    kontak: "0878-5566-3344",
    muridIds: ["mrd-7"],
  },
  {
    waliId: "wali-6",
    nama: "Bapak Nugroho",
    email: "nugroho.wali@kelolabimbel.test",
    kontak: "0811-7788-2233",
    muridIds: [],
  },
];

const KELAS_MURID: Record<string, string> = {
  "mrd-1": "Matematika SD Kelas 4",
  "mrd-2": "Bahasa Inggris SMP Kelas 7",
  "mrd-3": "IPA SD Kelas 6",
  "mrd-4": "Matematika SMP Kelas 8",
  "mrd-7": "Calistung TK",
  "mrd-8": "Calistung TK",
};

/** Semua akun wali beserta murid yang tertaut, untuk halaman pengaturan. */
export function getDaftarWali(): AkunWali[] {
  const murid = new Map(getDaftarMurid().map((anak) => [anak.id, anak.nama]));
  return PENAUTAN.map((wali) => ({
    waliId: wali.waliId,
    nama: wali.nama,
    email: wali.email,
    kontak: wali.kontak,
    murid: wali.muridIds.map((id) => ({
      muridId: id,
      nama: murid.get(id) ?? "Murid tidak dikenal",
      kelasNama: KELAS_MURID[id] ?? "Belum ada kelas",
    })),
  }));
}

/** Satu akun wali, atau `null` kalau tidak ada. */
export function getWali(waliId: string): AkunWali | null {
  return getDaftarWali().find((wali) => wali.waliId === waliId) ?? null;
}

/** Ringkasan singkat: berapa akun wali dan berapa yang sudah tertaut. */
export function ringkasPenautan(daftar: AkunWali[]) {
  return {
    jumlahAkun: daftar.length,
    jumlahTertaut: daftar.filter((wali) => wali.murid.length > 0).length,
    jumlahBelumTertaut: daftar.filter((wali) => wali.murid.length === 0).length,
    jumlahMurid: daftar.reduce((jumlah, wali) => jumlah + wali.murid.length, 0),
  };
}
