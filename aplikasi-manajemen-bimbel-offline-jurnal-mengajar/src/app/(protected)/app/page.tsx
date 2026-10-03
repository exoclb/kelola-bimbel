import type { Metadata } from "next";
import {
  ArrowUpRight,
  Check,
  Eye,
  History,
  NotebookPen,
  Plus,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { hasPermission, requireSession } from "@/lib/session";
import { CopyPrompt } from "@/components/copy-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Your app" };

export default async function AppPage() {
  const { user } = await requireSession();
  // Hiding the link is presentation only. /admin and its API guard themselves.
  const isAdmin = await hasPermission(user.id, { notes: ["read-any"] });
  // Hanya menampilkan pintasan; halaman & API pemantauan menjaga dirinya sendiri.
  const isOwner = await hasPermission(user.id, { jurnal: ["read-any"] });
  const bisaLihatGaji = await hasPermission(user.id, { gaji: ["read-any"] });
  const prompt =
    "Read AGENTS.md and use the build-feature skill. Replace the blank app page with [describe your first feature]. Keep authentication working, store any user data with Drizzle and PostgreSQL, and use Context7 to check library APIs.";

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        <Check className="size-4" aria-hidden="true" /> You’re signed in
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Welcome, {user.name}.
      </h1>
      <p className="mt-3 text-lg leading-7 text-muted-foreground">
        This is your app. Let’s give it something to do.
      </p>
      <Card className="mt-9 flex-row flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="space-y-1">
          <CardTitle>Jurnal Ngajar</CardTitle>
          <CardDescription>
            Catat kelas yang kamu ajar hari ini lewat pilihan cepat.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/app/jurnal">
              <NotebookPen aria-hidden="true" />
              Isi Jurnal Hari Ini
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/jurnal/riwayat">
              <History aria-hidden="true" />
              Riwayat Jurnal
            </Link>
          </Button>
        </div>
      </Card>
      <section
        className="mt-6 rounded-2xl border border-dashed bg-card px-6 py-10 sm:px-10"
        aria-labelledby="blank-canvas"
      >
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl border bg-muted">
          <Plus className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 id="blank-canvas" className="text-xl font-semibold tracking-tight">
          Your first feature starts here
        </h2>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
          A reading list? A space for project ideas? Tell your AI editor what
          you need, and build from this blank canvas.
        </p>
        <blockquote className="my-6 border-l-2 border-primary/50 pl-4 text-sm leading-7 text-muted-foreground">
          {prompt}
        </blockquote>
        <CopyPrompt text={prompt} />
      </section>
      {isOwner && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Pantau jurnal mengajar semua guru hari ini.
          </p>
          <Button variant="outline" asChild size="sm">
            <Link href="/app/pemantauan">
              <Eye aria-hidden="true" />
              Buka pemantauan
            </Link>
          </Button>
        </div>
      )}
      {bisaLihatGaji && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Hitung gaji guru bulan ini dari jam mengajar yang tercatat.
          </p>
          <Button variant="outline" asChild size="sm">
            <Link href="/app/gaji">
              <Wallet aria-hidden="true" />
              Buka rekap gaji
            </Link>
          </Button>
        </div>
      )}
      {isAdmin && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Your role can read every account’s notes.
          </p>
          <Button variant="outline" asChild size="sm">
            <Link href="/admin">
              <ShieldCheck aria-hidden="true" />
              Open admin
            </Link>
          </Button>
        </div>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm">
        <span className="break-all text-muted-foreground">
          Signed in as {user.email}
        </span>
        <Button variant="ghost" asChild size="sm">
          <Link href="/">
            Back to the starter
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
