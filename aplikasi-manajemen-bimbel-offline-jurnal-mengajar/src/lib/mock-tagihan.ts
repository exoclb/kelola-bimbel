// Data contoh tagihan bulanan murid.
//
// Tabel `student_invoices` belum ada, jadi daftarnya masih tiruan. Bentuk
// `Tagihan` mengikuti rencana kolom tabelnya (murid, periode bulan/tahun,
// nominal, status, tanggal bayar, penanda sudah diingatkan, jejak waktu),
// sehingga nanti tinggal diganti sumbernya. `kelasNama` hanya untuk tampilan,
// diambil dari penempatan murid.

import { periodeTagihan, type StatusTagihan } from "@/lib/tagihan";

export type Tagihan = {
  id: string;
  muridId: string;
  muridNama: string;
  /** Hanya untuk tampilan; di database kelas datang dari penempatan murid. */
  kelasNama: string;
  periodeBulan: number;
  periodeTahun: number;
  nominal: number;
  status: StatusTagihan;
  /** Diisi hanya kalau statusnya "lunas". */
  tanggalBayar: string | null;
  sudahDiingatkan: boolean;
  dibuatPada: string;
};

type TagihanTersimpan = Omit<
  Tagihan,
  "id" | "periodeBulan" | "periodeTahun" | "tanggalBayar" | "dibuatPada"
> & {
  /** 0 = bulan berjalan, -1 = bulan lalu, dan seterusnya. */
  geserBulan: number;
  /** Tanggal bayar dalam bulan itu, atau `null` bila belum dibayar. */
  tanggalBayarHari: number | null;
};

// Nominal contoh mengikuti jenjang kelas, dan statusnya campur supaya daftar
// lunas/belum lunas bisa ditinjau.
const TAGIHAN: TagihanTersimpan[] = [
  {
    muridId: "mrd-1",
    muridNama: "Aisyah Putri",
    kelasNama: "Matematika SD Kelas 4",
    nominal: 400000,
    status: "lunas",
    tanggalBayarHari: 3,
    sudahDiingatkan: false,
    geserBulan: 0,
  },
  {
    muridId: "mrd-2",
    muridNama: "Bima Saputra",
    kelasNama: "Bahasa Inggris SMP Kelas 7",
    nominal: 450000,
    status: "lunas",
    tanggalBayarHari: 2,
    sudahDiingatkan: false,
    geserBulan: 0,
  },
  {
    muridId: "mrd-3",
    muridNama: "Citra Ayu Lestari",
    kelasNama: "IPA SD Kelas 6",
    nominal: 400000,
    status: "belum_lunas",
    tanggalBayarHari: null,
    sudahDiingatkan: true,
    geserBulan: 0,
  },
  {
    muridId: "mrd-4",
    muridNama: "Dimas Pratama",
    kelasNama: "Matematika SMP Kelas 8",
    nominal: 450000,
    status: "belum_lunas",
    tanggalBayarHari: null,
    sudahDiingatkan: false,
    geserBulan: 0,
  },
  {
    muridId: "mrd-5",
    muridNama: "Eka Lestari",
    kelasNama: "Matematika SMP Kelas 8",
    nominal: 450000,
    status: "lunas",
    tanggalBayarHari: 4,
    sudahDiingatkan: false,
    geserBulan: 0,
  },
  {
    muridId: "mrd-7",
    muridNama: "Gita Permata",
    kelasNama: "Calistung TK",
    nominal: 350000,
    status: "lunas",
    tanggalBayarHari: 1,
    sudahDiingatkan: false,
    geserBulan: 0,
  },
  {
    muridId: "mrd-8",
    muridNama: "Hana Salsabila",
    kelasNama: "Calistung TK",
    nominal: 350000,
    status: "belum_lunas",
    tanggalBayarHari: null,
    sudahDiingatkan: false,
    geserBulan: 0,
  },
  {
    muridId: "mrd-1",
    muridNama: "Aisyah Putri",
    kelasNama: "Matematika SD Kelas 4",
    nominal: 400000,
    status: "lunas",
    tanggalBayarHari: 4,
    sudahDiingatkan: false,
    geserBulan: -1,
  },
  {
    muridId: "mrd-3",
    muridNama: "Citra Ayu Lestari",
    kelasNama: "IPA SD Kelas 6",
    nominal: 400000,
    status: "lunas",
    tanggalBayarHari: 6,
    sudahDiingatkan: true,
    geserBulan: -1,
  },
  {
    muridId: "mrd-4",
    muridNama: "Dimas Pratama",
    kelasNama: "Matematika SMP Kelas 8",
    nominal: 450000,
    status: "lunas",
    tanggalBayarHari: 15,
    sudahDiingatkan: true,
    geserBulan: -1,
  },
  {
    muridId: "mrd-2",
    muridNama: "Bima Saputra",
    kelasNama: "Bahasa Inggris SMP Kelas 7",
    nominal: 450000,
    status: "lunas",
    tanggalBayarHari: 5,
    sudahDiingatkan: false,
    geserBulan: -2,
  },
  {
    muridId: "mrd-5",
    muridNama: "Eka Lestari",
    kelasNama: "Matematika SMP Kelas 8",
    nominal: 450000,
    status: "lunas",
    tanggalBayarHari: 9,
    sudahDiingatkan: false,
    geserBulan: -2,
  },
  // Tunggakan contoh: belum lunas padahal bulannya sudah lewat.
  {
    muridId: "mrd-4",
    muridNama: "Dimas Pratama",
    kelasNama: "Matematika SMP Kelas 8",
    nominal: 450000,
    status: "belum_lunas",
    tanggalBayarHari: null,
    sudahDiingatkan: true,
    geserBulan: -1,
  },
  {
    muridId: "mrd-8",
    muridNama: "Hana Salsabila",
    kelasNama: "Calistung TK",
    nominal: 350000,
    status: "belum_lunas",
    tanggalBayarHari: null,
    sudahDiingatkan: false,
    geserBulan: -1,
  },
  {
    muridId: "mrd-3",
    muridNama: "Citra Ayu Lestari",
    kelasNama: "IPA SD Kelas 6",
    nominal: 400000,
    status: "belum_lunas",
    tanggalBayarHari: null,
    sudahDiingatkan: false,
    geserBulan: -2,
  },
];

/** Bulan dan tahun contoh untuk satu pergeseran bulan. */
function periodeDari(geserBulan: number) {
  const dasar = new Date();
  dasar.setDate(1);
  dasar.setMonth(dasar.getMonth() + geserBulan);
  return {
    periode: periodeTagihan(dasar),
    bulan: dasar.getMonth() + 1,
    tahun: dasar.getFullYear(),
  };
}

/** Seluruh tagihan contoh: periode berjalan plus dua bulan sebelumnya. */
export function getSemuaTagihan(): Tagihan[] {
  return TAGIHAN.map(({ geserBulan, tanggalBayarHari, ...baris }, urutan) => {
    const { periode, bulan, tahun } = periodeDari(geserBulan);
    return {
      ...baris,
      id: `inv-${TAGIHAN.length - urutan}`,
      periodeBulan: bulan,
      periodeTahun: tahun,
      tanggalBayar: tanggalBayarHari
        ? `${periode}-${String(tanggalBayarHari).padStart(2, "0")}`
        : null,
      dibuatPada: `${periode}-01T08:00:00`,
    };
  });
}

/** Periode satu baris tagihan dalam bentuk `YYYY-MM`. */
export function periodeDariTagihan(baris: Tagihan) {
  return `${baris.periodeTahun}-${String(baris.periodeBulan).padStart(2, "0")}`;
}

/** Tagihan satu periode, diurutkan menurut nama murid. */
export function getTagihanPeriode(bulan: number, tahun: number): Tagihan[] {
  return getSemuaTagihan()
    .filter(
      (baris) => baris.periodeBulan === bulan && baris.periodeTahun === tahun,
    )
    .sort((a, b) => a.muridNama.localeCompare(b.muridNama, "id"));
}

/** Periode yang punya tagihan, terbaru lebih dulu (mis. "2026-10"). */
export function getPeriodeTagihanTersedia(): string[] {
  return [...new Set(getSemuaTagihan().map(periodeDariTagihan))].sort((a, b) =>
    b.localeCompare(a),
  );
}

/** Nama murid yang punya tagihan, untuk pilihan pada saringan. */
export function getMuridTagihan(): string[] {
  return [...new Set(getSemuaTagihan().map((baris) => baris.muridNama))].sort(
    (a, b) => a.localeCompare(b, "id"),
  );
}

/** Riwayat tagihan satu murid, terbaru lebih dulu. */
export function getTagihanMurid(muridId: string): Tagihan[] {
  return getSemuaTagihan()
    .filter((baris) => baris.muridId === muridId)
    .sort((a, b) => periodeDariTagihan(b).localeCompare(periodeDariTagihan(a)));
}
