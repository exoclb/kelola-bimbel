"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  House,
  ReceiptText,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { cn } from "cn";
import { tabAktifDari } from "@/lib/nav-portal";

/**
 * Lima tab tetap Portal Wali. Susunannya mengikuti mockup: beranda, jadwal,
 * tagihan, progres, lalu akun. Tampilan ini hanya navigasi — setiap halaman
 * dan API-nya tetap memeriksa sesi dan izin sendiri.
 */
const TAB = [
  { href: "/portal", label: "Beranda", Ikon: House },
  { href: "/portal/jadwal", label: "Jadwal", Ikon: CalendarDays },
  { href: "/portal/tagihan", label: "Tagihan", Ikon: ReceiptText },
  { href: "/portal/perkembangan", label: "Progres", Ikon: TrendingUp },
  { href: "/portal/akun", label: "Akun", Ikon: UserRound },
] as const;

/**
 * Bilah tab bawah Portal Wali. Tab yang sedang dibuka ditandai dari alamat
 * halaman (pencocokan terpanjang, jadi `/portal/tagihan` tidak dianggap sama
 * dengan `/portal`), dan `aria-current` dipasang supaya pembaca layar tahu tab
 * mana yang aktif.
 */
export function NavBawahPortal() {
  const pathname = usePathname();
  const hrefAktif = tabAktifDari(
    TAB.map((tab) => tab.href),
    pathname,
  );

  return (
    <nav
      aria-label="Navigasi portal"
      className="bg-card fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-[480px] items-stretch">
        {TAB.map(({ href, label, Ikon }) => {
          const aktif = href === hrefAktif;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 text-3xs font-medium transition-colors",
                  aktif ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Ikon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
