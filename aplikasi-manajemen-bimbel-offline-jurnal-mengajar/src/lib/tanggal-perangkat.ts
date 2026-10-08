"use client";

import { useSyncExternalStore } from "react";
import { menitSekarang, tanggalISO } from "@/lib/tanggal";

/**
 * Jam perangkat wali untuk halaman portal.
 *
 * Lukisan pertama memakai nilai dari server supaya hasil render server dan
 * klien tidak berbeda, lalu React menghitung ulang dengan jam peramban — jadi
 * zona waktu server (mis. UTC di wadah produksi) tidak menggeser "hari ini"
 * atau jam sesi bagi pengguna di Indonesia.
 */

/** Langganan kosong: nilai dibaca ulang tiap render, bukan tiap kejadian. */
const tanpaLangganan = () => () => {};

/** Tanggal hari ini menurut jam perangkat wali (`YYYY-MM-DD`). */
export function useTanggalPerangkat(tanggalServer: string) {
  return useSyncExternalStore(
    tanpaLangganan,
    () => tanggalISO(new Date()),
    () => tanggalServer,
  );
}

/** Menit sejak tengah malam menurut jam perangkat wali. */
export function useMenitPerangkat(menitServer: number) {
  return useSyncExternalStore(
    tanpaLangganan,
    () => menitSekarang(),
    () => menitServer,
  );
}
