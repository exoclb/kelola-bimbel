import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RiwayatGajiGuru } from "@/components/riwayat-gaji-guru";
import { hasPermission, requireSession } from "@/lib/session";
import { riwayatGajiAnyGuru } from "@/services/gaji.service";

export const metadata: Metadata = { title: "Riwayat Gaji Guru" };

export default async function RiwayatGajiGuruPage({
  params,
  searchParams,
}: {
  params: Promise<{ guruId: string }>;
  searchParams: Promise<{ tahun?: string }>;
}) {
  const { user } = await requireSession();
  const [{ guruId }, query] = await Promise.all([params, searchParams]);

  // Rekap gaji semua guru hanya untuk owner; guru hanya boleh membuka
  // riwayatnya sendiri, dan id guru lain dijawab 404 seperti jalur owner lain
  // yang dijaga izin.
  const bolehSemua = await hasPermission(user.id, { gaji: ["read-any"] });
  if (!bolehSemua && user.id !== guruId) notFound();

  const diminta = Number(query.tahun ?? "");
  const tahunAwal =
    Number.isInteger(diminta) && diminta >= 2000 && diminta <= 2100
      ? diminta
      : new Date().getFullYear();

  // Sama seperti halaman riwayat gaji: tahun yang diminta hanya dipakai kalau
  // guru itu memang punya jurnal di situ, supaya saringan dan isinya tidak
  // saling bertentangan.
  let hasil = await riwayatGajiAnyGuru(guruId, tahunAwal);
  if (!hasil) notFound();
  if (hasil.tahunTersedia.length > 0 && !hasil.tahunTersedia.includes(tahunAwal)) {
    hasil = (await riwayatGajiAnyGuru(guruId, hasil.tahunTersedia[0])) ?? hasil;
  }

  const tahun = hasil.tahunTersedia.includes(tahunAwal)
    ? tahunAwal
    : (hasil.tahunTersedia[0] ?? tahunAwal);

  return (
    <RiwayatGajiGuru
      guru={hasil.guru}
      daftar={hasil.daftar}
      tahun={tahun}
      tahunTersedia={[...new Set([tahun, ...hasil.tahunTersedia])].sort(
        (a, b) => b - a,
      )}
      pemilik={user.id === guruId}
    />
  );
}
