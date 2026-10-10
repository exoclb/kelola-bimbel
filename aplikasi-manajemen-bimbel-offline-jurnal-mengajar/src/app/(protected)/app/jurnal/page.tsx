import type { Metadata } from "next";
import { JurnalForm, type JurnalTersimpanHari } from "@/components/jurnal-form";
import { pisahMateri } from "@/lib/jurnal";
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
  // menambah catatan kedua untuk sesi yang sama.
  const sudahDiisi: Record<string, JurnalTersimpanHari> = {};
  for (const jurnal of await listJurnalGuruTanggal(user.id, tanggal)) {
    if (!jurnal.scheduleId) continue;
    const { pilihan, topik } = pisahMateri(jurnal.materi);
    sudahDiisi[jurnal.scheduleId] = {
      materi: pilihan,
      topik,
      catatan: jurnal.catatan,
      hadir: Object.fromEntries(
        jurnal.kehadiran.map((baris) => [baris.muridId, baris.hadir]),
      ),
      keterangan: Object.fromEntries(
        jurnal.kehadiran
          .filter((baris) => baris.catatan)
          .map((baris) => [baris.muridId, baris.catatan]),
      ),
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
