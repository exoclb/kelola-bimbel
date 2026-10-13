// Susunan menu tiap peran.
//
// Peran sungguhan sudah tersimpan di kolom `user.role` (Better Auth), tetapi
// susunan menunya masih data tiruan: ditulis di sini dulu supaya perbedaan
// menu guru dan owner bisa ditinjau dari satu tempat. Menu hanyalah tampilan —
// halaman dan API-nya tetap memeriksa izin sendiri, jadi menyembunyikan menu
// bukan pengaman.
//
// Tautan halaman contoh pada navigasi mengikuti saklar mode rilis
// (`MODE_RILIS` lewat `src/lib/halaman-contoh.ts`): begitu penerapan ditandai
// rilis, tautannya tidak ikut terlukis sama sekali — bukan sekadar disembunyikan
// dengan gaya. Karena itu penaringnya dikerjakan di sini, tempat menu dibentuk
// di server; pemanggil menu tidak perlu tahu halaman mana yang termasuk contoh.
import { halamanContohAktif } from "@/lib/halaman-contoh";
import type { PeranPengguna } from "@/lib/peran";
import type { Permissions } from "@/lib/permissions";

export type MenuApp = {
  href: string;
  label: string;
  /** Kalau diisi, menu hanya tampil untuk akun yang punya izin tersebut. */
  perlu?: Permissions;
  /**
   * Halaman contoh (showcase) dari starter — bukan bagian aplikasi bimbel,
   * jadi tautannya tidak ikut ke penerapan rilis.
   */
  contoh?: boolean;
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
  // Halaman akun sendiri: kabar yang masuk ke pengguna, dengan penanda baca.
  { href: "/app/notifikasi", label: "Notifikasi" },
  { href: "/app/pengaturan", label: "Pengaturan" },
];

// Tautan halaman contoh (showcase) dari starter: isinya acuan bentuk antarmuka
// saat pengembangan, bukan bagian aplikasi bimbel. Tautannya hanya ikut ke menu
// selama saklar mode rilis masih menyala (`src/lib/halaman-contoh.ts`, dibaca
// dari env `MODE_RILIS` di `src/lib/mode-rilis.ts`), dan rutenya dijaga saklar
// yang sama.
export const TAUTAN_CONTOH: readonly MenuApp[] = [
  { href: "/app/contoh-status", label: "Contoh Status", contoh: true },
];

export const MENU_PER_PERAN: Record<PeranPengguna, MenuApp[]> = {
  // Guru: mengisi jurnal dan melihat gajinya sendiri.
  guru: [
    ...MENU_DASAR,
    { href: "/app/gaji/saya", label: "Gaji saya" },
    ...TAUTAN_CONTOH,
  ],
  // Owner: memantau jurnal semua guru dan mengelola rekap gaji.
  owner: [
    ...MENU_DASAR,
    { href: "/app/cabang", label: "Cabang", perlu: { pengaturan: ["read"] } },
    {
      href: "/app/pemantauan",
      label: "Pemantauan",
      perlu: { jurnal: ["read-any"] },
    },
    { href: "/app/gaji", label: "Gaji", perlu: { gaji: ["read-any"] } },
    {
      href: "/app/tagihan",
      label: "Tagihan",
      perlu: { tagihan: ["read-any"] },
    },
    {
      href: "/app/pengeluaran",
      label: "Pengeluaran",
      perlu: { pengeluaran: ["read-any"] },
    },
    {
      href: "/app/laba-rugi",
      label: "Laba Rugi",
      perlu: { pengeluaran: ["read-any"] },
    },
    {
      href: "/app/arus-kas",
      label: "Arus Kas",
      perlu: { pengeluaran: ["read-any"] },
    },
    ...TAUTAN_CONTOH,
  ],
  // Portal wali tidak memakai menu ini: perpindahan halamannya lewat bilah
  // lima tab di bawah (`src/components/nav-bawah-portal.tsx`).
  "orang-tua": [],
};

export type OpsiMenuPeran = {
  /**
   * Paksa tampil/tidaknya tautan halaman contoh. Bawaannya dibaca dari saklar
   * mode rilis (`src/lib/halaman-contoh.ts`), jadi pemanggil menu biasa —
   * `src/app/(protected)/layout.tsx` — cukup memanggil tanpa opsi ini dan
   * navigasinya otomatis bersih saat penerapan ditandai rilis. Opsi paksaan
   * dipakai uji dan pratinjau.
   */
  tautanContoh?: boolean;
};

/**
 * Salinan menu satu peran supaya pemanggil tidak mengubah daftar aslinya.
 * Tautan halaman contoh disaring di sini — mengikuti saklar mode rilis kalau
 * tidak dipaksa lewat opsi — jadi pemanggil menu cukup memanggil fungsi ini dan
 * tidak perlu tahu halaman mana saja yang termasuk contoh.
 */
export function menuUntukPeran(
  peran: PeranPengguna,
  { tautanContoh = halamanContohAktif() }: OpsiMenuPeran = {},
): MenuApp[] {
  return MENU_PER_PERAN[peran]
    .filter((menu) => tautanContoh || !menu.contoh)
    .map((menu) => ({ ...menu }));
}
