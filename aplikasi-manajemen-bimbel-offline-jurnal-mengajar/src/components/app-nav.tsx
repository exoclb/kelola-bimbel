"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import type { MenuApp } from "@/lib/mock-menu";

/**
 * Menu utama aplikasi. Daftarnya datang dari pemanggil (sudah disesuaikan
 * dengan peran akun), jadi komponen ini hanya mengurus tampilan dan penanda
 * halaman yang sedang dibuka.
 */
export function AppNav({ menu }: { menu: MenuApp[] }) {
  const pathname = usePathname();
  const hrefAktif = menu
    .map((tautan) => tautan.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav
      aria-label="Menu aplikasi"
      className="flex flex-wrap items-center gap-1"
    >
      {menu.map(({ href, label }) => {
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
