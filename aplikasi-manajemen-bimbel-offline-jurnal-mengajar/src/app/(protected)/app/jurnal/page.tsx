import type { Metadata } from "next";
import { JurnalForm, type JurnalTersimpanHari } from "@/components/jurnal-form";
import {
  pisahMateri,
  presensiDariCatatan,
  type StatusPresensiMurid,
} from "@/lib/jurnal";
import { requireSession } from "@/lib/session";
import { formatTanggalLengkap, namaHari, tanggalISO } from "@/lib/tanggal";
import { listJurnalGuruTanggal } from "@/services/jurnal.service";
import { listSesiPresensiGuru } from "@/services/presensi-guru.service";

export const metadata: Metadata = { title: "Jurnal Ngajar" };

export default async function JurnalPage() {
  const { user } = await requireSession();

  // Tanggal dihitung di server supaya tampilan dan data yang dikirim sama.
  const sekarang = new Date();
  const tanggal = tanggalISO(sekarang);

  // Sesi yang bisa diisi dibaca dari jadwal mingguan guru yang sedang masuk —
  // sumber yang sama dengan halaman presensi guru, jadi keduanya tidak pernah
  // menunjukkan daftar kelas yang berbeda.
  const sesi = await listSesiPresensiGuru(user.id, tanggal);
  const jadwal = sesi.map((item) => ({
    id: item.jadwalId,
    kelasId: item.classId,
    namaKelas: item.namaKelas,
    cabang: item.cabang,
    jamMulai: item.jamMulai,
    jamSelesai: item.jamSelesai,
    murid: item.murid,
  }));

  // Jurnal yang sudah diisi hari ini ikut dimuat: guru melihat kembali isi
  // sebelumnya, dan tahu kiriman ulang memperbarui catatan itu — bukan
  // menambah catatan kedua untuk sesi yang sama. Status presensinya dibaca
  // kembali dari pasangan `hadir` + `catatan` lewat `presensiDariCatatan`,
  // jadi alasan yang tersimpan muncul lagi sebagai pilihan yang sama.
  const sudahDiisi: Record<string, JurnalTersimpanHari> = {};
  for (const jurnal of await listJurnalGuruTanggal(user.id, tanggal)) {
    if (!jurnal.scheduleId) continue;
    const { pilihan, topik } = pisahMateri(jurnal.materi);
    const presensi: Record<string, StatusPresensiMurid> = {};
    const alasan: Record<string, string> = {};
    for (const baris of jurnal.kehadiran) {
      const hasil = presensiDariCatatan(baris.hadir, baris.catatan);
      presensi[baris.muridId] = hasil.status;
      if (hasil.catatan) alasan[baris.muridId] = hasil.catatan;
    }
    sudahDiisi[jurnal.scheduleId] = {
      materi: pilihan,
      topik,
      catatan: jurnal.catatan,
      presensi,
      alasan,
    };
  }

  return (
    <JurnalForm
      jadwal={jadwal}
      sudahDiisi={sudahDiisi}
      hari={namaHari(sekarang)}
      namaGuru={user.name}
      tanggalTampil={formatTanggalLengkap(sekarang)}
    />
  );
}
