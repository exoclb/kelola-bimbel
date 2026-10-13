import { withApiPermission } from "@/lib/api";
import {
  ambilStatusBackup,
  jalankanBackupDanCatat,
} from "@/services/backup.service";
import { listBackupSchema } from "@/validators/pengaturan";

export const runtime = "nodejs";

// Riwayat backup beserta ringkasannya: beberapa catatan terbaru, backup terakhir
// yang berhasil, dan jumlah per status. Hanya membaca catatan yang ditulis
// proses backup di server, jadi tidak butuh izin tulis.
export function GET(request: Request) {
  return withApiPermission(request, { pengaturan: ["read"] }, async () => {
    const { limit } = listBackupSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return Response.json({ data: await ambilStatusBackup(limit) });
  });
}

// Pemicu backup manual dari halaman Pengaturan → Backup Database.
//
// Izinnya tulis, bukan baca: siapa pun yang boleh melihat riwayat belum tentu
// boleh menyalin seluruh database. Dump-nya dijalankan sambil permintaan ini
// menunggu, jadi permintaan baru dijawab setelah salinannya selesai dibuat atau
// gagal — halaman yang memanggilnya bisa langsung melaporkan hasilnya tanpa
// membaca ulang riwayat.
//
// Jawabannya tetap 201 walau prosesnya gagal: yang dibuat di sini adalah
// catatannya, dan alasannya ada di `data.status`/`data.pesan`. Aplikasi tidak
// mengunci backup yang sedang berjalan, sama seperti dua jadwal yang tumpang
// tindih — yang menahan klik ganda adalah keadaan tombolnya di halaman.
export function POST(request: Request) {
  return withApiPermission(request, { pengaturan: ["write"] }, async () =>
    Response.json({ data: await jalankanBackupDanCatat() }, { status: 201 }),
  );
}
