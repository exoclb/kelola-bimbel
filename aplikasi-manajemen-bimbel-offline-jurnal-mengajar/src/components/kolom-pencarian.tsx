"use client";

import { useId } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type KolomPencarianProps = {
  nilai: string;
  onUbah: (nilai: string) => void;
  label: string;
  placeholder: string;
};

/**
 * Kolom pencarian dengan ikon dan label tersembunyi. Dipakai halaman data
 * murid dan kelas supaya pencariannya seragam.
 */
export function KolomPencarian({
  nilai,
  onUbah,
  label,
  placeholder,
}: KolomPencarianProps) {
  const id = useId();

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Search
          className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          value={nilai}
          placeholder={placeholder}
          className="pl-9"
          onChange={(event) => onUbah(event.target.value)}
        />
      </div>
    </div>
  );
}
