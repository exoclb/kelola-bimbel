import { z } from "zod";

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Tanggal dalam bentuk `YYYY-MM-DD` yang benar-benar ada di kalender. Bentuk
 * yang lolos pola tapi tanggalnya tidak ada (mis. 2026-02-30) akan ditolak
 * PostgreSQL sebagai error server, jadi diperiksa di sini.
 */
export const skemaTanggal = z
  .string()
  .regex(POLA_TANGGAL, "Pakai format tanggal YYYY-MM-DD.")
  .refine((nilai) => {
    const [tahun, bulan, hari] = nilai.split("-").map(Number);
    const waktu = new Date(Date.UTC(tahun, bulan - 1, hari));
    return (
      waktu.getUTCFullYear() === tahun &&
      waktu.getUTCMonth() === bulan - 1 &&
      waktu.getUTCDate() === hari
    );
  }, "Tanggal itu tidak ada di kalender.");

/** Bulan dalam bentuk `YYYY-MM`. */
export const skemaPeriodeBulan = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pakai format bulan YYYY-MM.");
