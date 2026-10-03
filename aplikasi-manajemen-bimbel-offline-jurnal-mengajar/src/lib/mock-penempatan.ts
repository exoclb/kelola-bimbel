// Data contoh penempatan murid ke kelas.
//
// Tabel `student_enrollments` belum ada di database, jadi penempatan disimpan
// di layar. Bentuk `Penempatan` mengikuti kolom tabelnya (student_id, class_id,
// tanggal_mulai, status), sehingga nanti tinggal diganti sumbernya.

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
];

/** Pengganti sementara `GET /api/penempatan`. */
export function getPenempatanAwal(): Penempatan[] {
  return PENEMPATAN.map((baris) => ({ ...baris }));
}
