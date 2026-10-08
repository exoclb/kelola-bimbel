import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PresensiSesi } from "@/components/presensi-sesi";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, tanggalISO } from "@/lib/tanggal";
import {
  getJurnalIdSesi,
  getSesiPresensiGuru,
} from "@/services/presensi-guru.service";

export const metadata: Metadata = { title: "Presensi Sesi" };

export default async function PresensiSesiPage({
  params,
}: {
  params: Promise<{ jadwalId: string }>;
}) {
  const { user } = await requireSession();
  const { jadwalId } = await params;

  // Id dari URL hanya dipakai kalau bentuknya benar, supaya alamat asing
  // berakhir di halaman "tidak ditemukan", bukan galat server.
  if (!z.string().uuid().safeParse(jadwalId).success) notFound();

  // Hanya sesi hari ini milik guru yang sedang masuk yang bisa dibuka.
  const sekarang = new Date();
  const tanggal = tanggalISO(sekarang);
  const sesi = await getSesiPresensiGuru(user.id, jadwalId, tanggal);
  if (!sesi) notFound();

  // Jurnal sesi ini (kalau sudah diisi) dipakai untuk tautan silang, supaya
  // presensi guru dan jurnal mengajar bisa ditelusuri dari dua arah.
  const jurnalId = await getJurnalIdSesi(user.id, jadwalId, tanggal);

  return (
    <PresensiSesi
      sesi={sesi}
      jurnalId={jurnalId}
      namaGuru={user.name}
      tanggalTampil={formatTanggalLengkap(sekarang)}
    />
  );
}
