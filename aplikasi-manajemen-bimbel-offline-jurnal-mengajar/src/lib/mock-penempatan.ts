// Data contoh penempatan murid ke kelas.
//
// Tabel `student_enrollments` belum ada di database, jadi penempatan disimpan
// di layar. Bentuk `Penempatan` mengikuti kolom tabelnya (student_id, class_id,
// tanggal_mulai, status), sehingga nanti tinggal diganti sumbernya.

import { getDaftarKelas, type Kelas } from "@/lib/mock-kelas";

export type Penempatan = {
  muridId: string;
  kelasId: string;
  tanggalMulai: string;
  status: "aktif" | "selesai";
};

const PENEMPATAN: Penempatan[] = [
  {
    muridId: "mrd-1",
    kelasId: "kls-1",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
  {
    muridId: "mrd-2",
    kelasId: "kls-1",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
  {
    muridId: "mrd-4",
    kelasId: "kls-1",
    tanggalMulai: "2026-08-15",
    status: "aktif",
  },
  {
    muridId: "mrd-5",
    kelasId: "kls-2",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
  {
    muridId: "mrd-7",
    kelasId: "kls-2",
    tanggalMulai: "2026-07-01",
    status: "aktif",
  },
  {
    muridId: "mrd-3",
    kelasId: "kls-3",
    tanggalMulai: "2026-07-10",
    status: "aktif",
  },
  {
    muridId: "mrd-8",
    kelasId: "kls-3",
    tanggalMulai: "2026-07-10",
    status: "aktif",
  },
  // Contoh aturan multi-kelas: satu murid boleh aktif di lebih dari satu
  // kelas (pasangan murid–kelas tetap unik), dan penempatan lama disimpan
  // sebagai riwayat berstatus "selesai" alih-alih dihapus.
  {
    muridId: "mrd-1",
    kelasId: "kls-3",
    tanggalMulai: "2026-08-01",
    status: "aktif",
  },
  {
    muridId: "mrd-1",
    kelasId: "kls-2",
    tanggalMulai: "2026-02-10",
    status: "selesai",
  },
  {
    muridId: "mrd-2",
    kelasId: "kls-2",
    tanggalMulai: "2026-08-10",
    status: "aktif",
  },
  {
    muridId: "mrd-3",
    kelasId: "kls-4",
    tanggalMulai: "2026-03-01",
    status: "selesai",
  },
];

/** Pengganti sementara `GET /api/penempatan`. */
export function getPenempatanAwal(): Penempatan[] {
  return PENEMPATAN.map((baris) => ({ ...baris }));
}

/** Satu penempatan lengkap dengan data kelasnya, untuk halaman detail murid. */
export type KelasMurid = {
  kelas: Kelas;
  tanggalMulai: string;
  status: Penempatan["status"];
};

/**
 * Seluruh kelas yang sedang dan pernah diikuti seorang murid, yang aktif lebih
 * dulu lalu yang terbaru. Murid yang belum pernah ditempatkan menghasilkan
 * daftar kosong.
 */
export function kelasMurid(muridId: string): KelasMurid[] {
  const daftarKelas = getDaftarKelas();
  return PENEMPATAN.filter((baris) => baris.muridId === muridId)
    .map((baris) => {
      const kelas = daftarKelas.find((item) => item.id === baris.kelasId);
      return kelas
        ? { kelas, tanggalMulai: baris.tanggalMulai, status: baris.status }
        : undefined;
    })
    .filter((baris): baris is KelasMurid => baris !== undefined)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "aktif" ? -1 : 1;
      return b.tanggalMulai.localeCompare(a.tanggalMulai);
    });
}
