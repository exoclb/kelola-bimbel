import type { Metadata } from "next";
import { JadwalAnakPortal } from "@/components/jadwal-anak-portal";
import { statusSemuaAnak } from "@/services/jejak-baca.service";
import { listJadwalAnak, muatIsiPortalWali } from "@/services/portal.service";
import { requireSession } from "@/lib/session";
import { tanggalISO } from "@/lib/tanggal";

export const metadata: Metadata = { title: "Jadwal Belajar" };

export default async function JadwalBelajarPage({
  searchParams,
}: {
  searchParams: Promise<{ anak?: string }>;
}) {
  const session = await requireSession();

  // Anak yang tampil diambil dari basis data untuk wali yang sedang masuk,
  // sedangkan jadwalnya menyusul dari jadwal kelas yang sedang mereka ikuti.
  const { anak } = await muatIsiPortalWali(session.user.id);
  const params = await searchParams;
  // Hanya anak yang tertaut ke akun wali ini yang boleh dipakai dari alamat.
  const terpilih =
    anak.find((baris) => baris.muridId === params.anak) ?? anak[0];

  return (
    <JadwalAnakPortal
      anak={anak}
      muridId={terpilih?.muridId ?? ""}
      statusAwal={await statusSemuaAnak(session.user.id, anak)}
      jadwal={await listJadwalAnak(anak.map((baris) => baris.muridId))}
      tanggalServer={tanggalISO(new Date())}
    />
  );
}
