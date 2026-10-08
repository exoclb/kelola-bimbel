import type { ComponentProps, ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

/**
 * Isian formulir dengan label, keterangan, dan pesan kesalahannya sendiri.
 * Semua halaman memakai bentuk yang sama supaya pesan kesalahan selalu muncul
 * di bawah isian yang salah dan tersambung ke pembaca layar
 * (`aria-describedby` + `aria-invalid`).
 */

type DasarIsian = {
  id: string;
  label: string;
  /** Pesan kesalahan untuk isian ini; kosong berarti isiannya sudah benar. */
  error?: string;
  /** Penjelasan singkat di bawah isian (disembunyikan kalau ada error). */
  keterangan?: string;
  /** Tinggi kontrol: `sentuh` memakai 48px dan teks 16px untuk layar portal. */
  ukuran?: UkuranIsian;
  className?: string;
};

/**
 * Ukuran kontrol isian. `sentuh` dipakai Portal Wali supaya tingginya
 * memenuhi target sentuh 48px (`--target-sentuh-portal`) dan teksnya tetap
 * 16px — di ponsel ukuran itu mencegah peramban memperbesar halaman saat
 * isian difokuskan.
 */
export type UkuranIsian = "biasa" | "sentuh";

const GAYA_SENTUH = "h-[var(--target-sentuh-portal)] text-base md:text-base";

function BungkusIsian({
  id,
  label,
  error,
  keterangan,
  className,
  children,
}: DasarIsian & { children: ReactNode }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {keterangan && !error && (
        <p className="text-sm text-muted-foreground">{keterangan}</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type IsianTeksProps = DasarIsian & {
  /** Ikon kecil di dalam isian, mis. surat atau telepon. */
  ikon?: ReactNode;
} & Omit<ComponentProps<typeof Input>, "id" | "className">;

/** Isian satu baris (input). */
export function IsianTeks({
  id,
  label,
  error,
  keterangan,
  ukuran,
  className,
  ikon,
  ...input
}: IsianTeksProps) {
  const gaya = ukuran === "sentuh" ? GAYA_SENTUH : undefined;
  return (
    <BungkusIsian
      id={id}
      label={label}
      error={error}
      keterangan={keterangan}
      className={className}
    >
      {ikon ? (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          >
            {ikon}
          </span>
          <Input
            id={id}
            className={cn("pl-9", gaya)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            {...input}
          />
        </div>
      ) : (
        <Input
          id={id}
          className={gaya}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...input}
        />
      )}
    </BungkusIsian>
  );
}

type IsianTeksPanjangProps = DasarIsian &
  Omit<ComponentProps<typeof Textarea>, "id" | "className">;

/** Isian beberapa baris (textarea). */
export function IsianTeksPanjang({
  id,
  label,
  error,
  keterangan,
  ukuran,
  className,
  ...textarea
}: IsianTeksPanjangProps) {
  return (
    <BungkusIsian
      id={id}
      label={label}
      error={error}
      keterangan={keterangan}
      className={className}
    >
      <Textarea
        id={id}
        className={ukuran === "sentuh" ? "text-base md:text-base" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...textarea}
      />
    </BungkusIsian>
  );
}

type IsianPilihProps = DasarIsian &
  Omit<ComponentProps<typeof NativeSelect>, "id" | "className"> & {
    /** Daftar pilihannya, mis. <option value="…">…</option>. */
    children: ReactNode;
  };

/** Isian pilihan (select). */
export function IsianPilih({
  id,
  label,
  error,
  keterangan,
  ukuran,
  className,
  children,
  ...select
}: IsianPilihProps) {
  return (
    <BungkusIsian
      id={id}
      label={label}
      error={error}
      keterangan={keterangan}
      className={className}
    >
      <NativeSelect
        id={id}
        className={ukuran === "sentuh" ? GAYA_SENTUH : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...select}
      >
        {children}
      </NativeSelect>
    </BungkusIsian>
  );
}
