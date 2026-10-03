"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** Tombol keluar: mengakhiri sesi, lalu kembali ke halaman masuk. */
export function SignOutButton() {
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
    <div className="flex flex-wrap items-center gap-2">
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
        size="sm"
      >
        <LogOut aria-hidden="true" />
        {pending ? "Sedang keluar…" : "Keluar"}
      </Button>
    </div>
  );
}
