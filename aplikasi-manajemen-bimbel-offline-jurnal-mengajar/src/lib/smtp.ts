import "server-only";
import { z } from "zod";

// Konfigurasi SMTP dibaca dari variabel lingkungan supaya penyedia email bisa
// diganti tanpa menyentuh kode (Fase 1 roadmap). Modul ini hanya MEMBACA dan
// MEMERIKSA isian — ia tidak mengirim email dan tidak pernah melempar galat.
// Pemanggil memakai `siap` untuk memutuskan: kirim lewat SMTP, atau catat
// tautannya ke log server seperti sebelumnya. Jadi aplikasi tetap jalan penuh
// walau bimbel belum punya penyedia email.
//
// Sandi hanya keluar dari sini sebagai bagian `konfigurasi` (server-only) dan
// tidak pernah masuk ke `keterangan` — pesan itu dipakai di log dan layar.
//
// Berkas ini sengaja tidak memakai impor berawalan "@/", sama seperti
// lib/dokumen-html.ts, supaya bisa diuji langsung `node --test`.

/** Nama variabel lingkungan yang dibaca modul ini. */
export const VARIABEL_SMTP = {
  host: "SMTP_HOST",
  port: "SMTP_PORT",
  secure: "SMTP_SECURE",
  pengguna: "SMTP_USER",
  sandi: "SMTP_PASSWORD",
  pengirim: "SMTP_FROM",
  namaPengirim: "SMTP_FROM_NAME",
} as const;

/** Port bawaan penyedia modern: 587 dengan STARTTLS. */
export const PORT_SMTP_BAWAAN = 587;

/** Port yang membuka TLS sejak awal koneksi. */
export const PORT_SMTP_TLS_LANGSUNG = 465;

export type KonfigurasiSmtp = {
  host: string;
  port: number;
  /** true = TLS sejak awal (biasanya 465), false = STARTTLS (587). */
  aman: boolean;
  /** Kosong berarti server SMTP menerima pengiriman tanpa autentikasi. */
  pengguna?: string;
  sandi?: string;
  pengirim: {
    alamat: string;
    /** Nama tampilan di kotak masuk penerima; opsional. */
    nama?: string;
  };
};

export type StatusKonfigurasiSmtp =
  | { siap: true; konfigurasi: KonfigurasiSmtp; keterangan: string }
  | {
      siap: false;
      konfigurasi: null;
      keterangan: string;
      /** Variabel yang perlu dilengkapi/diperbaiki operator. */
      variabelBermasalah: string[];
    };

const NILAI_BENAR = ["true", "1", "ya", "yes", "on"];
const NILAI_SALAH = ["false", "0", "tidak", "no", "off"];

/**
 * Baca konfigurasi SMTP dari variabel lingkungan. Hasilnya selalu berupa status,
 * bukan pengecualian: isian yang belum lengkap dilaporkan lewat `keterangan` dan
 * `variabelBermasalah` supaya bisa ditampilkan di halaman status lingkungan.
 *
 * Aturan isian (dokumentasi sama dengan .env.example):
 * - `SMTP_HOST` wajib sebelum fitur email dianggap aktif.
 * - `SMTP_PORT` opsional, bawaannya 587.
 * - `SMTP_SECURE` opsional; kalau kosong diturunkan dari port (465 = TLS awal).
 * - `SMTP_USER` dan `SMTP_PASSWORD` harus diisi bersamaan (atau keduanya kosong).
 * - `SMTP_FROM` opsional; kalau kosong alamat pengirim memakai `SMTP_USER`.
 */
export function bacaKonfigurasiSmtp(
  sumber: NodeJS.ProcessEnv = process.env,
): StatusKonfigurasiSmtp {
  const isi = (nama: string) => (sumber[nama] ?? "").trim();
  const host = isi(VARIABEL_SMTP.host);
  const pengguna = isi(VARIABEL_SMTP.pengguna);
  // Sandi tidak di-trim: spasi di ujung bisa jadi bagian sandi yang sah.
  const sandi = sumber[VARIABEL_SMTP.sandi] ?? "";
  const namaPengirim = isi(VARIABEL_SMTP.namaPengirim);
  const alamatPengirim = isi(VARIABEL_SMTP.pengirim) || pengguna;

  // Tanpa host, fitur email memang tidak diaktifkan — itu keadaan sah, bukan
  // kesalahan isian, jadi keterangannya menjelaskan cadangan yang tetap jalan.
  if (!host)
    return {
      siap: false,
      konfigurasi: null,
      keterangan:
        "SMTP belum diatur; tautan atur ulang sandi tetap dicatat ke log server.",
      variabelBermasalah: [VARIABEL_SMTP.host],
    };

  const masalah: string[] = [];
  const variabelBermasalah = new Set<string>();

  const mentahPort = isi(VARIABEL_SMTP.port);
  let port = PORT_SMTP_BAWAAN;
  if (mentahPort) {
    port = Number(mentahPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      masalah.push(`${VARIABEL_SMTP.port} harus nomor port 1–65535.`);
      variabelBermasalah.add(VARIABEL_SMTP.port);
      port = PORT_SMTP_BAWAAN;
    }
  }

  const mentahAman = isi(VARIABEL_SMTP.secure).toLowerCase();
  let aman = port === PORT_SMTP_TLS_LANGSUNG;
  if (mentahAman) {
    if (NILAI_BENAR.includes(mentahAman)) aman = true;
    else if (NILAI_SALAH.includes(mentahAman)) aman = false;
    else {
      masalah.push(
        `${VARIABEL_SMTP.secure} harus true atau false (dikosongkan pun boleh).`,
      );
      variabelBermasalah.add(VARIABEL_SMTP.secure);
    }
  }

  // Akun setengah terisi hampir selalu salah ketik, bukan server tanpa
  // autentikasi; lebih baik ketahuan di halaman status daripada saat kirim.
  if (Boolean(pengguna) !== Boolean(sandi)) {
    masalah.push(
      `${VARIABEL_SMTP.pengguna} dan ${VARIABEL_SMTP.sandi} harus diisi bersama-sama.`,
    );
    variabelBermasalah.add(pengguna ? VARIABEL_SMTP.sandi : VARIABEL_SMTP.pengguna);
  }

  if (!alamatPengirim) {
    masalah.push(
      `Isi ${VARIABEL_SMTP.pengirim} sebagai alamat pengirim, atau ${VARIABEL_SMTP.pengguna} sebagai cadangannya.`,
    );
    variabelBermasalah.add(VARIABEL_SMTP.pengirim);
  } else if (!z.email().safeParse(alamatPengirim).success) {
    masalah.push(`${VARIABEL_SMTP.pengirim} bukan alamat email yang sah.`);
    variabelBermasalah.add(VARIABEL_SMTP.pengirim);
  }

  if (masalah.length > 0)
    return {
      siap: false,
      konfigurasi: null,
      keterangan: `Konfigurasi SMTP belum bisa dipakai: ${masalah.join(" ")}`,
      variabelBermasalah: [...variabelBermasalah],
    };

  return {
    siap: true,
    konfigurasi: {
      host,
      port,
      aman,
      ...(pengguna ? { pengguna, sandi } : {}),
      pengirim: {
        alamat: alamatPengirim,
        ...(namaPengirim ? { nama: namaPengirim } : {}),
      },
    },
    keterangan: `SMTP siap dipakai: ${host}:${port}${aman ? " (TLS sejak awal)" : " (STARTTLS)"}.`,
  };
}

/** Pintasan untuk pemanggil yang hanya perlu tahu bisa-tidaknya kirim email. */
export function smtpSiap(sumber: NodeJS.ProcessEnv = process.env) {
  return bacaKonfigurasiSmtp(sumber).siap;
}
