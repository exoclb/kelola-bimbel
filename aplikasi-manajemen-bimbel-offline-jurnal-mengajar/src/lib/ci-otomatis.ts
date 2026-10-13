// Bentuk ringkasan CI otomatis (Pengaturan → Status CI).
//
// Pipa CI-nya dijalankan GitHub Actions dari `.github/workflows/ci.yml` setiap
// ada push dan pull request: memasang dependensi, memeriksa kode dan tipe,
// menguji otomatis, memeriksa format, membangun aplikasinya, lalu menjalankan
// skenario peramban. Halaman status hanya membacakan hasilnya supaya tim tahu
// lebih dulu kalau ada yang rusak — sebelum rilis, bukan sesudah.
//
// Berkas ini netral: sekarang dipakai data contoh di layar, dan nanti dipakai
// layanan server saat hasil jalannya dibaca dari sumber sungguhan —
// pemisahan yang sama dengan `src/lib/jadwal-backup.ts`.
//
// Sengaja tanpa impor berawalan "@/" supaya bisa diuji langsung `node --test`.

/** Keadaan satu jalan (satu kali pipa dijalankan). */
export type StatusJalanCi = "berjalan" | "lulus" | "gagal";

/**
 * Keadaan satu pemeriksaan di dalam satu jalan.
 *
 * - `dilewati`: jalannya sudah berhenti sebelum langkah ini dijalankan —
 *   GitHub Actions memang berhenti pada kegagalan pertama.
 * - `menunggu`: jalannya masih berjalan dan langkah ini belum sampai.
 */
export type StatusPemeriksaanCi =
  "berjalan" | "lulus" | "gagal" | "dilewati" | "menunggu";

/** Satu langkah baku pipa CI, mengikuti urutan langkah di ci.yml. */
export type PemeriksaanCi = {
  kunci: string;
  nama: string;
  /** Perintah yang dijalankan langkah ini. */
  perintah: string;
  keterangan: string;
};

export const PEMERIKSAAN_CI: readonly PemeriksaanCi[] = [
  {
    kunci: "penyiapan",
    nama: "Penyiapan proyek",
    perintah: "npm run setup",
    keterangan:
      "Memasang dependensi dan menyiapkan berkas lingkungan serta kunci auth. Langkah ini paling dulu: kalau gagal, langkah berikutnya tidak pernah jalan.",
  },
  {
    kunci: "pemeriksaan-kode",
    nama: "Pemeriksaan kode & uji otomatis",
    perintah: "npm run check",
    keterangan:
      "Lint, pemeriksaan tipe, lalu seluruh uji unit dan integrasi. Langkah terlama dan paling sering menangkap kesalahan.",
  },
  {
    kunci: "format",
    nama: "Format berkas",
    perintah: "npm run format:check",
    keterangan:
      "Memastikan tata tulisan seluruh berkas masih seragam menurut Prettier.",
  },
  {
    kunci: "build",
    nama: "Build produksi",
    perintah: "npm run build",
    keterangan:
      "Membangun aplikasinya seperti saat rilis, jadi impor atau tipe yang belum tersentuh uji pun ikut ketahuan.",
  },
  {
    kunci: "uji-end-to-end",
    nama: "Uji end-to-end (Playwright)",
    perintah: "npm run test:e2e",
    keterangan:
      "Menjalankan skenario peramban pada basis data uji sekali pakai. Hasil ujinya diunggah sebagai artefak test-results selama 7 hari kalau langkah ini gagal.",
  },
];

/** Hasil satu pemeriksaan pada satu jalan. */
export type HasilPemeriksaanCi = {
  /** Cocok dengan `PemeriksaanCi.kunci`. */
  kunci: string;
  status: StatusPemeriksaanCi;
  /** Lamanya langkah itu; null berarti belum selesai. */
  durasiDetik: number | null;
  /** Catatan hasilnya, mis. jumlah uji yang lulus atau sebab kegagalannya. */
  catatan: string | null;
};

/** Satu jalan CI yang tercatat. */
export type JalanCi = {
  id: string;
  /** Hash commit pendek yang diperiksa. */
  commit: string;
  pesanCommit: string;
  cabang: string;
  mulai: Date;
  selesai: Date | null;
  status: StatusJalanCi;
  /**
   * Pemeriksaan yang sudah punya hasil. Langkah yang tidak tercatat di sini
   * berarti belum jalan — keadaannya disimpulkan dari status jalannya.
   */
  pemeriksaan: HasilPemeriksaanCi[];
};

/** Satu langkah baku lengkap dengan hasilnya, siap ditampilkan. */
export type BarisPemeriksaanCi = PemeriksaanCi & HasilPemeriksaanCi;

/** Hitungan keadaan pemeriksaan pada satu jalan. */
export type HitunganPemeriksaanCi = {
  total: number;
  lulus: number;
  gagal: number;
  dilewati: number;
  berjalan: number;
  menunggu: number;
};

/** Definisi langkah baku dari kuncinya; kunci asing dikembalikan apa adanya. */
export function definisiPemeriksaan(kunci: string): PemeriksaanCi {
  return (
    PEMERIKSAAN_CI.find((item) => item.kunci === kunci) ?? {
      kunci,
      nama: kunci,
      perintah: "",
      keterangan: "",
    }
  );
}

/**
 * Seluruh langkah baku satu jalan, urut seperti urutan pipa CI-nya. Langkah
 * yang belum punya hasil tetap digambar: "menunggu" selagi jalannya masih
 * berjalan, "dilewati" kalau jalannya sudah berhenti lebih dulu.
 */
export function barisPemeriksaanCi(jalan: JalanCi): BarisPemeriksaanCi[] {
  return PEMERIKSAAN_CI.map((definisi) => {
    const hasil = jalan.pemeriksaan.find(
      (item) => item.kunci === definisi.kunci,
    );
    return {
      ...definisi,
      status:
        hasil?.status ??
        (jalan.status === "berjalan" ? "menunggu" : "dilewati"),
      durasiDetik: hasil?.durasiDetik ?? null,
      catatan: hasil?.catatan ?? null,
    };
  });
}

/** Hitung tiap keadaan pemeriksaan untuk ringkasan di atas daftar. */
export function hitungPemeriksaanCi(
  baris: readonly BarisPemeriksaanCi[],
): HitunganPemeriksaanCi {
  const jumlah = (status: StatusPemeriksaanCi) =>
    baris.filter((item) => item.status === status).length;
  return {
    total: baris.length,
    lulus: jumlah("lulus"),
    gagal: jumlah("gagal"),
    dilewati: jumlah("dilewati"),
    berjalan: jumlah("berjalan"),
    menunggu: jumlah("menunggu"),
  };
}

/** Jalan paling baru, atau null kalau riwayatnya kosong. */
export function jalanTerbaru(riwayat: readonly JalanCi[]): JalanCi | null {
  let terbaru: JalanCi | null = null;
  for (const jalan of riwayat) {
    if (!terbaru || jalan.mulai.getTime() > terbaru.mulai.getTime()) {
      terbaru = jalan;
    }
  }
  return terbaru;
}

/** Jalan terakhir yang sudah selesai — termasuk yang gagal, apa adanya. */
export function jalanTerakhirSelesai(
  riwayat: readonly JalanCi[],
): JalanCi | null {
  return jalanTerbaru(riwayat.filter((jalan) => jalan.selesai !== null));
}

/** Jalan yang masih berjalan, kalau ada. */
export function ciSedangBerjalan(riwayat: readonly JalanCi[]): JalanCi | null {
  return jalanTerbaru(riwayat.filter((jalan) => jalan.status === "berjalan"));
}

/** Langkah pertama yang gagal pada satu jalan, atau null kalau tidak ada. */
export function pemeriksaanGagalCi(jalan: JalanCi): BarisPemeriksaanCi | null {
  return (
    barisPemeriksaanCi(jalan).find((item) => item.status === "gagal") ?? null
  );
}

/**
 * Saran perbaikan per langkah. Isinya sengaja tidak menyebut berkas atau nilai
 * apa pun dari mesin ini: yang dibaca orang dari CI merah adalah langkah mana
 * yang berhenti dan apa yang harus dijalankannya sendiri di komputer.
 */
export const SARAN_KEGAGALAN_CI: Record<string, string> = {
  penyiapan:
    "Periksa versi Node di .nvmrc dan berkas kunci package-lock.json: penyiapan gagal biasanya karena versinya tidak cocok atau berkas kuncinya tidak sinkron.",
  "pemeriksaan-kode":
    "Jalankan “npm run check” di komputer sendiri lalu perbaiki yang merah dulu. Uji yang gagal di sini akan gagal sama di server.",
  format: "Jalankan “npm run format”, lalu commit hasil rapikannya.",
  build:
    "Jalankan “npm run build” dengan variabel lingkungan seperti di server; galatnya biasanya impor atau tipe yang belum dipakai.",
  "uji-end-to-end":
    "Jalankan berkas ujinya sendiri, mis. “npm run test:e2e -- e2e/<berkas>.spec.ts”. Artefak test-results berisi potret dan jejak langkah saat gagal.",
};

/** Saran perbaikan satu langkah; langkah asing dapat saran umum. */
export function saranPerbaikan(kunci: string): string {
  return (
    SARAN_KEGAGALAN_CI[kunci] ??
    "Jalankan langkah itu di komputer sendiri untuk melihat pesan galatnya, perbaiki penyebabnya, lalu push lagi."
  );
}

/** Rincian satu kegagalan: apa yang berhenti, apa yang ikut batal, dan saran. */
export type RincianKegagalanCi = {
  /** Langkah yang berhenti, lengkap dengan hasilnya. */
  pemeriksaan: BarisPemeriksaanCi;
  /** Langkah sesudahnya yang tidak sempat dijalankan. */
  dilewati: BarisPemeriksaanCi[];
  /** Apa yang perlu dikerjakan supaya jalan berikutnya lulus. */
  saran: string;
};

/**
 * Rincian langkah yang menghentikan satu jalan, atau null kalau jalan itu tidak
 * gagal. Langkah sesudahnya ikut dibawa karena itu bagian dari akibatnya:
 * kegagalan di langkah ketiga berarti dua langkah terakhir tidak diperiksa.
 */
export function rincianKegagalanCi(jalan: JalanCi): RincianKegagalanCi | null {
  const pemeriksaan = pemeriksaanGagalCi(jalan);
  if (!pemeriksaan) return null;
  const baris = barisPemeriksaanCi(jalan);
  const indeks = baris.findIndex((item) => item.kunci === pemeriksaan.kunci);
  return {
    pemeriksaan,
    dilewati: baris
      .slice(indeks + 1)
      .filter((item) => item.status === "dilewati"),
    saran: saranPerbaikan(pemeriksaan.kunci),
  };
}

/** Lama satu langkah dalam detik, mis. "18 detik" atau "3 menit 2 detik". */
export function lamaDetik(detik: number | null): string | null {
  if (detik === null) return null;
  const aman = Math.max(0, Math.round(detik));
  if (aman < 60) return `${aman} detik`;
  const menit = Math.floor(aman / 60);
  const sisa = aman % 60;
  if (sisa === 0) return `${menit} menit`;
  return `${menit} menit ${sisa} detik`;
}

/**
 * Satu kalimat pendek tentang keadaan satu jalan, dipakai kartu ringkasan di
 * halaman pengaturan dan di daftar riwayatnya.
 */
export function ringkasJalanCi(jalan: JalanCi): string {
  const hitungan = hitungPemeriksaanCi(barisPemeriksaanCi(jalan));
  if (jalan.status === "berjalan") {
    const selesai = hitungan.lulus + hitungan.gagal;
    return `Sedang berjalan: ${selesai} dari ${hitungan.total} pemeriksaan sudah selesai.`;
  }
  if (jalan.status === "lulus") {
    return `Lulus: ${hitungan.lulus} dari ${hitungan.total} pemeriksaan lulus.`;
  }
  const gagal = pemeriksaanGagalCi(jalan);
  return gagal
    ? `Gagal di ${gagal.nama}: ${hitungan.lulus} dari ${hitungan.total} pemeriksaan lulus sebelum berhenti.`
    : `Gagal: ${hitungan.lulus} dari ${hitungan.total} pemeriksaan lulus.`;
}
