"use client";

import { authClient } from "@/lib/auth-client";
import { roles, type Permissions } from "@/lib/permissions";
import { peranDariRole, type PeranPengguna } from "@/lib/peran";

/**
 * Membaca peran akun yang sedang masuk dan memeriksa izinnya di sisi klien.
 *
 * Ini **hanya untuk tampilan** — menyembunyikan tombol atau menu bukan
 * pengaman. Setiap halaman memakai `requirePermission` dan setiap endpoint
 * memakai `withApiPermission`, jadi akun yang tidak berhak tetap ditolak
 * walau tampilannya dipaksa muncul.
 */
export function useIzinPeran() {
  const { data, isPending } = authClient.useSession();
  const role = data?.user?.role ?? "";
  const daftarRole = role
    .split(",")
    .map((nilai) => nilai.trim().toLowerCase())
    .filter(Boolean);

  return {
    /** Benar selama sesi masih dibaca; jangan tampilkan apa pun dulu. */
    memuat: isPending,
    masuk: Boolean(data?.user),
    peran: peranDariRole(role) as PeranPengguna,
    /** Benar kalau salah satu peran akun punya seluruh izin yang diminta. */
    punya: (izin: Permissions) =>
      daftarRole.some(
        (nama) =>
          roles[nama as keyof typeof roles]?.authorize(izin).success ?? false,
      ),
  };
}
