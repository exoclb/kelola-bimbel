"use client";

import { ShieldCheck, ShieldX } from "lucide-react";
import { PenjagaIzin } from "@/components/penjaga-izin";
import { useIzinPeran } from "@/lib/izin-klien";

/**
 * Contoh pemakaian penjaga akses peran di sisi klien. Bagian yang butuh izin
 * `pengaturan: read` hanya muncul untuk owner/admin; guru melihat keterangan
 * bahwa bagian itu disembunyikan.
 */
export function ContohPenjagaIzin() {
  const { memuat, peran, punya } = useIzinPeran();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {memuat
          ? "Membaca sesi…"
          : `Peran akun ini: ${peran === "owner" ? "Owner" : "Guru"}`}
      </p>

      <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium">Cek izin langsung (hook)</p>
        <p className="mt-1 text-muted-foreground">
          {memuat
            ? "Menunggu sesi…"
            : punya({ pengaturan: ["read"] })
              ? "Boleh mengubah pengaturan bimbel."
              : "Tidak boleh mengubah pengaturan bimbel."}
        </p>
      </div>

      <PenjagaIzin
        izin={{ pengaturan: ["read"] }}
        cadangan={
          <p className="flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <ShieldX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Bagian ini hanya untuk owner; guru tidak melihat isinya.
          </p>
        }
      >
        <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          Tombol pengaturan bimbel tampil karena akun ini punya izinnya. Halaman
          dan API-nya tetap memeriksa izin sendiri, jadi ini hanya tampilan.
        </p>
      </PenjagaIzin>
    </div>
  );
}
