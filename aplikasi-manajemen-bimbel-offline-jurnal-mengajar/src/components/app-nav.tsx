"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const TAUTAN = [
  { href: "/app", label: "Beranda" },
  { href: "/app/jurnal", label: "Isi Jurnal" },
  { href: "/app/jurnal/riwayat", label: "Riwayat" },
];

/**
 * Menu utama aplikasi. Menu Pemantauan hanya ditampilkan kalau akunnya memang
 * boleh membukanya; ini murni tampilan — halaman dan API-nya tetap memeriksa
 * izin sendiri, jadi menyembunyikan menu bukan pengaman.
 */
export function AppNav({ pemantauan }: { pemantauan: boolean }) {
  const pathname = usePathname();
  const daftar = pemantauan
    ? [...TAUTAN, { href: "/app/pemantauan", label: "Pemantauan" }]
    : TAUTAN;
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
