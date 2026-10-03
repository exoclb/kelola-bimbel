"use client";

import type { ReactNode } from "react";
import { useIzinPeran } from "@/lib/izin-klien";
import type { Permissions } from "@/lib/permissions";

type PenjagaIzinProps = {
  /** Izin yang dibutuhkan, mis. { pengaturan: ["read"] }. */
  izin: Permissions;
  children: ReactNode;
  /** Ditampilkan kalau izinnya tidak ada; bawaan: tidak menampilkan apa pun. */
  cadangan?: ReactNode;
};

/**
 * Menampilkan isinya hanya kalau akun yang sedang masuk punya izinnya. Selama
 * sesi masih dibaca, `cadangan` yang tampil supaya bagian yang butuh izin tidak
 * sempat berkedip muncul.
 *
 * Tampilan saja: halaman dan API tetap memeriksa sendiri.
 */
export function PenjagaIzin({
  izin,
  children,
  cadangan = null,
}: PenjagaIzinProps) {
  const { memuat, punya } = useIzinPeran();

  if (memuat) return <>{cadangan}</>;
  return <>{punya(izin) ? children : cadangan}</>;
}
