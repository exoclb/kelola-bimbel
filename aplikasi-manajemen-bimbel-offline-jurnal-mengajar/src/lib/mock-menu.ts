// Susunan menu tiap peran.
//
// Peran sungguhan sudah tersimpan di kolom `user.role` (Better Auth), tetapi
// susunan menunya masih data tiruan: ditulis di sini dulu supaya perbedaan
// menu guru dan owner bisa ditinjau dari satu tempat. Menu hanyalah tampilan —
// halaman dan API-nya tetap memeriksa izin sendiri, jadi menyembunyikan menu
// bukan pengaman.
import type { PeranPengguna } from "@/lib/peran";
import type { Permissions } from "@/lib/permissions";

export type MenuApp = {
  href: string;
  label: string;
  /** Kalau diisi, menu hanya tampil untuk akun yang punya izin tersebut. */
  perlu?: Permissions;
};

// Menu yang sama untuk semua peran: pekerjaan harian dan data bimbel.
const MENU_DASAR: MenuApp[] = [
  { href: "/app", label: "Beranda" },
  { href: "/app/jurnal", label: "Isi Jurnal" },
  { href: "/app/jurnal/riwayat", label: "Riwayat" },
  { href: "/app/presensi-guru", label: "Presensi Guru" },
  { href: "/app/murid", label: "Murid" },
  { href: "/app/kelas", label: "Kelas" },
  { href: "/app/penempatan", label: "Penempatan" },
  { href: "/app/perkembangan", label: "Perkembangan" },
  { href: "/app/pengaturan", label: "Pengaturan" },
];

export const MENU_PER_PERAN: Record<PeranPengguna, MenuApp[]> = {
  // Guru: mengisi jurnal dan melihat gajinya sendiri.
  guru: [...MENU_DASAR, { href: "/app/gaji/saya", label: "Gaji saya" }],
  // Owner: memantau jurnal semua guru dan mengelola rekap gaji.
  owner: [
    ...MENU_DASAR,
    {
      href: "/app/pemantauan",
      label: "Pemantauan",
      perlu: { jurnal: ["read-any"] },
    },
    { href: "/app/gaji", label: "Gaji", perlu: { gaji: ["read-any"] } },
  ],
};

/** Salinan menu satu peran supaya pemanggil tidak mengubah daftar aslinya. */
export function menuUntukPeran(peran: PeranPengguna): MenuApp[] {
  return MENU_PER_PERAN[peran].map((menu) => ({ ...menu }));
}
