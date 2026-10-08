import type { Metadata } from "next";
import { DaftarWali } from "@/components/daftar-wali";
import { listAkunWali, listMuridRingkas } from "@/services/wali.service";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Penautan Akun Wali" };

export default async function PenautanWaliPage() {
  // Penautan akun wali menyangkut data seluruh murid: hanya owner.
  await requirePermission({ pengaturan: ["read"] });

  // Satu sumber untuk halaman ini dan `/api/wali`: layanan wali yang membaca
  // tabel `user` (peran `orang-tua`), `students`, dan `wali_murid`.
  const [daftar, murid] = await Promise.all([
    listAkunWali(),
    listMuridRingkas(),
  ]);

  return <DaftarWali daftar={daftar} daftarMurid={murid} />;
}
