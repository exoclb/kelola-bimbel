"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/** Tombol keluar: mengakhiri sesi, lalu kembali ke halaman masuk. */
export function SignOutButton({
  ukuran = "biasa",
}: {
  /** `aksi` memakai tombol setinggi 48px milik Portal Wali. */
  ukuran?: "biasa" | "aksi";
} = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        ukuran === "aksi" && "w-full",
      )}
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Gagal keluar. Coba lagi.
        </p>
      )}
      <Button
        type="button"
        onClick={signOut}
        disabled={pending}
        variant="outline"
        size={ukuran === "aksi" ? "aksi" : "sm"}
        className={ukuran === "aksi" ? "w-full" : undefined}
      >
        <LogOut aria-hidden="true" />
        {pending ? "Sedang keluar…" : "Keluar"}
      </Button>
    </div>
  );
}
