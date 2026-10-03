"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TAUTAN = [
  { href: "/app", label: "Beranda" },
  { href: "/app/jurnal", label: "Isi Jurnal" },
  { href: "/app/jurnal/riwayat", label: "Riwayat" },
  { href: "/app/murid", label: "Murid" },
];

/**
 * Menu utama aplikasi. Menu Pemantauan hanya ditampilkan kalau akunnya memang
 * boleh membukanya, dan menu Gaji mengarah ke rekap semua guru (owner) atau
 * rekap milik sendiri (guru). Ini murni tampilan — halaman dan API-nya tetap
 * memeriksa izin sendiri, jadi menyembunyikan menu bukan pengaman.
 */
export function AppNav({
  pemantauan,
  gaji,
}: {
  pemantauan: boolean;
  gaji: boolean;
}) {
  const pathname = usePathname();
  const daftar = [
    ...TAUTAN,
    ...(pemantauan ? [{ href: "/app/pemantauan", label: "Pemantauan" }] : []),
    ...(gaji
      ? [{ href: "/app/gaji", label: "Gaji" }]
      : [{ href: "/app/gaji/saya", label: "Gaji saya" }]),
  ];
  const hrefAktif = daftar
    .map((tautan) => tautan.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav
      aria-label="Menu aplikasi"
      className="flex flex-wrap items-center gap-1"
    >
      {daftar.map(({ href, label }) => {
        const aktif = href === hrefAktif;
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              aktif
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
