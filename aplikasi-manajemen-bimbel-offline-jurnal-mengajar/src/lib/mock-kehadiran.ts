// Data contoh kehadiran murid per pertemuan.
//
// Kehadiran sebenarnya tersimpan di tabel `journal_attendances` (satu baris per
// murid per jurnal), tetapi API-nya belum ada, jadi halaman perkembangan
// memakai data tiruan ini. Bentuknya mengikuti kolom tabel tersebut.

export type KehadiranPertemuan = {
  muridId: string;
  tanggal: string;
  hadir: boolean;
  catatan: string;
};

const KEHADIRAN: KehadiranPertemuan[] = [
  { muridId: "mrd-1", tanggal: "2026-09-06", hadir: true, catatan: "" },
  { muridId: "mrd-1", tanggal: "2026-09-13", hadir: true, catatan: "" },
  { muridId: "mrd-1", tanggal: "2026-09-20", hadir: true, catatan: "" },
  { muridId: "mrd-1", tanggal: "2026-09-27", hadir: true, catatan: "" },
  { muridId: "mrd-2", tanggal: "2026-09-07", hadir: true, catatan: "" },
  { muridId: "mrd-2", tanggal: "2026-09-14", hadir: false, catatan: "Sakit" },
  { muridId: "mrd-2", tanggal: "2026-09-21", hadir: true, catatan: "" },
  { muridId: "mrd-2", tanggal: "2026-09-28", hadir: true, catatan: "" },
  { muridId: "mrd-3", tanggal: "2026-09-04", hadir: true, catatan: "" },
  { muridId: "mrd-3", tanggal: "2026-09-11", hadir: true, catatan: "" },
  { muridId: "mrd-3", tanggal: "2026-09-18", hadir: true, catatan: "" },
  { muridId: "mrd-4", tanggal: "2026-09-01", hadir: true, catatan: "" },
  { muridId: "mrd-4", tanggal: "2026-09-08", hadir: true, catatan: "" },
  { muridId: "mrd-4", tanggal: "2026-09-15", hadir: true, catatan: "" },
  { muridId: "mrd-4", tanggal: "2026-09-22", hadir: true, catatan: "" },
  {
    muridId: "mrd-5",
    tanggal: "2026-09-05",
    hadir: false,
    catatan: "Izin lomba",
  },
  { muridId: "mrd-5", tanggal: "2026-09-12", hadir: true, catatan: "" },
  { muridId: "mrd-5", tanggal: "2026-09-19", hadir: true, catatan: "" },
  { muridId: "mrd-5", tanggal: "2026-09-26", hadir: false, catatan: "Demam" },
  { muridId: "mrd-7", tanggal: "2026-09-03", hadir: true, catatan: "" },
  { muridId: "mrd-7", tanggal: "2026-09-10", hadir: true, catatan: "" },
  { muridId: "mrd-7", tanggal: "2026-09-24", hadir: true, catatan: "" },
  { muridId: "mrd-8", tanggal: "2026-09-02", hadir: true, catatan: "" },
  { muridId: "mrd-8", tanggal: "2026-09-09", hadir: true, catatan: "" },
  { muridId: "mrd-8", tanggal: "2026-09-23", hadir: true, catatan: "" },
];

/** Pengganti sementara kehadiran murid dari jurnal-jurnal yang sudah diisi. */
export function getKehadiranAwal(): KehadiranPertemuan[] {
  return KEHADIRAN.map((baris) => ({ ...baris }));
}
