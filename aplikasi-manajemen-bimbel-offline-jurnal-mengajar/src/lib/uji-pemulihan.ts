// Bentuk catatan uji pemulihan backup (Pengaturan → Backup → Uji Pemulihan)
// beserta penilaian kesegarannya.
//
// Uji pemulihan membuktikan berkas backup benar-benar bisa dibuka kembali:
// salinannya dipulihkan ke database percobaan (bukan database produksi), lalu
// beberapa pemeriksaan sederhana menunjukkan datanya utuh. Hasil tiap uji
// dicatat supaya kesiapan rilis punya bukti yang bisa ditelusuri, bukan cuma
// keyakinan bahwa "backup-nya jalan".
//
// Berkas ini netral: sekarang dipakai data contoh di layar, dan nanti dipakai
// layanan server saat catatannya pindah ke basis data — pemisahan yang sama
// dengan `src/lib/jadwal-backup.ts`.
//
// Sengaja tanpa impor berawalan "@/" supaya bisa diuji langsung `node --test`.

/** Keadaan satu uji pemulihan. */
export type StatusUjiPemulihan = "berjalan" | "berhasil" | "gagal";

/** Satu pemeriksaan keutuhan data setelah pemulihan. */
export type PemeriksaanPemulihan = {
  /** Yang diperiksa, mis. "Jumlah murid sesuai". */
  nama: string;
  /** true kalau pemeriksaan itu lulus. */
  lulus: boolean;
};

/** Satu catatan uji pemulihan yang tersimpan. */
export type UjiPemulihan = {
  id: string;
  /** Berkas backup yang dipulihkan (path lengkapnya di server). */
  berkas: string;
  /** Database percobaan tempat pemulihan dijalankan, mis. `kelola_restore`. */
  lingkungan: string;
  mulai: Date;
  selesai: Date | null;
  status: StatusUjiPemulihan;
  /** Pemeriksaan yang dijalankan; kosong berarti belum diperiksa. */
  pemeriksaan: PemeriksaanPemulihan[];
  /** Catatan tambahan: alasan gagal atau ringkasan hasil. */
  catatan: string | null;
};

/** Berkas backup yang siap dipulihkan pada uji pemulihan. */
export type BerkasBackupUji = {
  id: string;
  /** Path lengkap berkas salinan di server. */
  lokasi: string;
  /** Waktu salinan itu dibuat. */
  dibuat: Date;
  ukuranByte: number;
};

/**
 * Selang anjuran mengulang uji pemulihan, dalam hari. Dokumen deploy menulis
 * "minimal satu kali per periode" tanpa angka; 90 hari dipilih supaya tiap
 * kuartal ada bukti pulih yang masih segar, sejalan dengan pemeriksaan berkala
 * di checklist go-live.
 */
export const JEDA_UJI_HARI = 90;

/** Nama berkas dari sebuah path, mis. `20260705-020000.dump`. */
export function namaBerkasUji(lokasi: string) {
  const potongan = lokasi.split("/");
  return potongan[potongan.length - 1] || lokasi;
}

/** Ringkasan pemeriksaan, mis. "3 dari 4 pemeriksaan lulus". */
export function ringkasanPemeriksaan(uji: UjiPemulihan) {
  const lulus = uji.pemeriksaan.filter(
    (pemeriksaan) => pemeriksaan.lulus,
  ).length;
  return `${lulus} dari ${uji.pemeriksaan.length} pemeriksaan lulus`;
}

/** Semua pemeriksaan lulus; daftar kosong berarti belum ada yang diperiksa. */
export function semuaPemeriksaanLulus(uji: UjiPemulihan) {
  return uji.pemeriksaan.length > 0 && uji.pemeriksaan.every((p) => p.lulus);
}

/** Satu pemeriksaan baku beserta artinya bagi pemilik bimbel. */
export type PemeriksaanBaku = {
  nama: string;
  keterangan: string;
};

/**
 * Pemeriksaan yang harus dicocokkan tiap kali uji pemulihan, dipakai untuk
 * menilai apakah sebuah uji benar-benar memverifikasi datanya: uji yang hanya
 * memeriksa satu hal belum membuktikan sisanya ikut selamat.
 */
export const PEMERIKSAAN_BAKU: PemeriksaanBaku[] = [
  {
    nama: "Jumlah murid sesuai",
    keterangan:
      "Muridnya ikut pulih — ada isinya dan tidak melebihi jumlah murid di produksi sekarang.",
  },
  {
    nama: "Jumlah jurnal mengajar sesuai",
    keterangan:
      "Catatan jurnal mengajar ikut pulih, bukan cuma tabelnya yang terbentuk kosong.",
  },
  {
    nama: "Jumlah tagihan sesuai",
    keterangan:
      "Tagihan dan pembayarannya utuh, jadi tidak ada angka keuangan yang hilang.",
  },
  {
    nama: "Akun owner bisa masuk",
    keterangan:
      "Masih ada akun owner yang aktif dan bersandi di data hasil pemulihan, jadi bimbel masih bisa dibuka.",
  },
];

/** Jumlah baris penting sebuah database, dipakai untuk menilai hasil pemulihan. */
export type IsiDatabase = {
  murid: number;
  jurnal: number;
  tagihan: number;
  ownerAktif: number;
};

/**
 * Menyusun hasil pemeriksaan baku atas isi database percobaan.
 *
 * Pembandingnya adalah jumlah di produksi **sekarang**, bukan jumlah saat backup
 * dibuat: jumlah saat itu tidak tersimpan di mana pun. Karena salinannya selalu
 * dibuat lebih dulu, isinya boleh lebih sedikit — jurnal dan tagihan bertambah
 * terus — tapi tidak boleh kosong: tabel yang terbentuk tanpa isi berarti
 * berkasnya tidak benar-benar ikut pulih. Salinan yang justru lebih banyak
 * daripada produksi dilaporkan gagal juga, karena itu tanda ada data yang
 * terhapus setelah backup dibuat.
 *
 * Nama pemeriksaannya sengaja ditulis sama persis dengan `PEMERIKSAAN_BAKU`:
 * halaman mencocokkannya berdasarkan nama, jadi pemeriksaan yang namanya beda
 * akan terbaca sebagai "belum diperiksa".
 */
export function susunPemeriksaanPemulihan(
  dipulihkan: IsiDatabase,
  produksi: IsiDatabase,
  { lingkungan }: { lingkungan: string },
): { pemeriksaan: PemeriksaanPemulihan[]; catatan: string } {
  const terisi = (jumlah: number, tersedia: number) =>
    jumlah > 0 && jumlah <= tersedia;

  const pemeriksaan: PemeriksaanPemulihan[] = [
    {
      nama: "Jumlah murid sesuai",
      lulus: terisi(dipulihkan.murid, produksi.murid),
    },
    {
      nama: "Jumlah jurnal mengajar sesuai",
      lulus: terisi(dipulihkan.jurnal, produksi.jurnal),
    },
    {
      nama: "Jumlah tagihan sesuai",
      lulus: terisi(dipulihkan.tagihan, produksi.tagihan),
    },
    { nama: "Akun owner bisa masuk", lulus: dipulihkan.ownerAktif > 0 },
  ];

  // Angkanya ditulis di catatan supaya yang membaca bisa menilai sendiri selisih
  // kecil yang wajar (jurnal hari ini) dari selisih yang mencurigakan.
  const angka = (isi: IsiDatabase) =>
    `${isi.murid} murid, ${isi.jurnal} jurnal mengajar, ${isi.tagihan} tagihan, ${isi.ownerAktif} akun owner aktif`;
  const bagian: Array<[string, number, number]> = [
    ["murid", dipulihkan.murid, produksi.murid],
    ["jurnal mengajar", dipulihkan.jurnal, produksi.jurnal],
    ["tagihan", dipulihkan.tagihan, produksi.tagihan],
  ];

  const temuan: string[] = [];
  const kosong = bagian.filter(([, jumlah]) => jumlah === 0);
  if (kosong.length)
    temuan.push(
      `Tabel ${kosong.map(([nama]) => nama).join(", ")} kosong di salinan, jadi isinya tidak ikut pulih.`,
    );
  const berlebih = bagian.filter(([, jumlah, tersedia]) => jumlah > tersedia);
  if (berlebih.length)
    temuan.push(
      `${berlebih.map(([nama]) => nama).join(", ")} di salinan lebih banyak daripada produksi sekarang — kemungkinan ada data yang terhapus setelah backup dibuat.`,
    );
  if (dipulihkan.ownerAktif === 0)
    temuan.push(
      "Tidak ada akun owner yang aktif dan bersandi di data hasil pemulihan, jadi belum tentu bimbel bisa dibuka.",
    );

  const catatan = [
    `Isi database percobaan ${lingkungan}: ${angka(dipulihkan)}.`,
    `Produksi sekarang: ${angka(produksi)}.`,
    temuan.length
      ? temuan.join(" ")
      : "Salinannya terisi dan tidak melebihi produksi, jadi isinya ikut pulih.",
  ].join(" ");

  return { pemeriksaan, catatan };
}

/** Hasil satu pemeriksaan pada sebuah catatan uji. */
export type HasilPemeriksaan = "lulus" | "gagal" | "belum-diperiksa";

/**
 * Hasil satu pemeriksaan bernama `nama` pada catatan uji; `belum-diperiksa`
 * kalau pemeriksaan itu tidak dijalankan sama sekali.
 */
export function hasilPemeriksaan(
  uji: UjiPemulihan,
  nama: string,
): HasilPemeriksaan {
  const ditemukan = uji.pemeriksaan.find(
    (pemeriksaan) => pemeriksaan.nama === nama,
  );
  if (!ditemukan) return "belum-diperiksa";
  return ditemukan.lulus ? "lulus" : "gagal";
}

/** Pemeriksaan yang dijalankan tapi tidak ada di daftar baku. */
export function pemeriksaanTambahan(uji: UjiPemulihan) {
  const baku = new Set(PEMERIKSAAN_BAKU.map((pemeriksaan) => pemeriksaan.nama));
  return uji.pemeriksaan.filter((pemeriksaan) => !baku.has(pemeriksaan.nama));
}

/** Hitungan pemeriksaan: berapa yang dicatat, berapa lulus, berapa gagal. */
export function hitungPemeriksaan(pemeriksaan: PemeriksaanPemulihan[]) {
  const lulus = pemeriksaan.filter((satu) => satu.lulus).length;
  return {
    total: pemeriksaan.length,
    lulus,
    gagal: pemeriksaan.length - lulus,
  };
}

/** Penilaian keutuhan data sebuah catatan uji. */
export type TingkatVerifikasi =
  "terverifikasi" | "bermasalah" | "belum-lengkap" | "belum-ada";

/**
 * Menilai verifikasi sebuah catatan uji: ada pemeriksaan yang tidak lulus →
 * bermasalah; semuanya lulus tapi daftar bakunya belum lengkap → belum
 * lengkap; seluruh daftar baku lulus → terverifikasi; tanpa pemeriksaan sama
 * sekali → belum ada yang diverifikasi.
 */
export function tingkatVerifikasi(uji: UjiPemulihan): TingkatVerifikasi {
  if (uji.pemeriksaan.length === 0) return "belum-ada";
  if (uji.pemeriksaan.some((pemeriksaan) => !pemeriksaan.lulus))
    return "bermasalah";
  const belum = PEMERIKSAAN_BAKU.filter(
    (baku) => hasilPemeriksaan(uji, baku.nama) === "belum-diperiksa",
  );
  return belum.length === 0 ? "terverifikasi" : "belum-lengkap";
}

/**
 * Uji pemulihan terakhir yang berhasil, atau `null` kalau belum pernah ada.
 * Yang dihitung hanya catatan `berhasil`: uji yang gagal justru alasan untuk
 * mengulang uji, bukan pengganti bukti bahwa salinannya bisa dipulihkan.
 */
export function ujiTerakhirBerhasil(riwayat: UjiPemulihan[]) {
  return palingBaru(riwayat.filter((uji) => uji.status === "berhasil"));
}

/**
 * Uji pemulihan terakhir yang sudah selesai — berhasil maupun gagal. Dipakai
 * menampilkan verifikasi hasil pulih: uji yang gagal pun perlu diperlihatkan
 * apa yang sudah dicocokkan dan apa yang tidak lulus.
 */
export function ujiTerakhirSelesai(riwayat: UjiPemulihan[]) {
  return palingBaru(riwayat.filter((uji) => uji.selesai !== null));
}

/**
 * Tahap baku satu proses pemulihan, berurutan dari persiapan sampai
 * pencatatan hasil. Dipakai layar untuk menunjukkan prosesnya sedang di mana.
 */
export type KunciTahapPemulihan =
  "siapkan-database" | "pulihkan-berkas" | "periksa-data" | "catat-hasil";

export type TahapPemulihan = {
  kunci: KunciTahapPemulihan;
  label: string;
  keterangan: string;
};

export const TAHAP_PEMULIHAN: TahapPemulihan[] = [
  {
    kunci: "siapkan-database",
    label: "Siapkan database percobaan",
    keterangan: "Membuat database kosong khusus uji, terpisah dari produksi.",
  },
  {
    kunci: "pulihkan-berkas",
    label: "Pulihkan berkas backup",
    keterangan: "Memasukkan seluruh isi berkas salinan ke database percobaan.",
  },
  {
    kunci: "periksa-data",
    label: "Periksa keutuhan data",
    keterangan:
      "Menghitung isi database percobaan lalu membandingkannya dengan produksi sekarang.",
  },
  {
    kunci: "catat-hasil",
    label: "Catat hasil uji",
    keterangan:
      "Menyimpan hasilnya ke riwayat supaya jadi bukti yang bisa ditelusuri.",
  },
];

/**
 * Taksiran lama satu tahap, dipakai untuk menebak tahap mana yang sedang
 * berjalan. Catatan ujinya hanya menyimpan waktu mulai dan selesai, jadi
 * tahapnya dihitung dari umur prosesnya; angkanya mengikuti lama pemulihan di
 * `docs/deploy-coolify.md` — puluhan detik per tahap, tergantung ukuran basis
 * datanya.
 */
export const DETIK_PER_TAHAP = 45;

/** Indeks tahap yang sedang berjalan pada sebuah waktu. */
export function indeksTahapBerjalan(mulai: Date, sekarang: Date) {
  const detik = Math.max(0, (sekarang.getTime() - mulai.getTime()) / 1000);
  return Math.min(
    TAHAP_PEMULIHAN.length - 1,
    Math.floor(detik / DETIK_PER_TAHAP),
  );
}

/** Kemajuan seluruh proses, 0–100. */
export function persenPemulihan(mulai: Date, sekarang: Date) {
  const seluruhDetik = TAHAP_PEMULIHAN.length * DETIK_PER_TAHAP;
  const detik = Math.max(0, (sekarang.getTime() - mulai.getTime()) / 1000);
  return Math.min(100, Math.floor((detik / seluruhDetik) * 100));
}

/** Perkiraan waktu seluruh tahapnya selesai. */
export function perkiraanSelesai(mulai: Date) {
  return new Date(
    mulai.getTime() + TAHAP_PEMULIHAN.length * DETIK_PER_TAHAP * 1000,
  );
}

/** Keadaan satu tahap saat prosesnya dilihat. */
export type StatusTahap = "selesai" | "berjalan" | "menunggu" | "gagal";

/**
 * Keadaan tahap ke-`urutan`: yang sudah dilewati selesai, tahap yang sedang
 * berjalan menyandang keadaan ujinya (berjalan atau gagal — uji yang gagal
 * berhenti di tahap itu), dan sisanya masih menunggu. Uji yang berhasil
 * melewati seluruh tahapnya.
 */
export function statusTahap(
  urutan: number,
  indeksBerjalan: number,
  statusUji: StatusUjiPemulihan,
): StatusTahap {
  if (statusUji === "berhasil") return "selesai";
  if (urutan < indeksBerjalan) return "selesai";
  if (urutan > indeksBerjalan) return "menunggu";
  return statusUji === "gagal" ? "gagal" : "berjalan";
}

/** Catatan paling baru dari sebuah daftar, atau `null` kalau daftarnya kosong. */
function palingBaru(daftar: UjiPemulihan[]) {
  if (daftar.length === 0) return null;
  return daftar.reduce((terbaru, uji) =>
    uji.mulai.getTime() > terbaru.mulai.getTime() ? uji : terbaru,
  );
}

/** Uji pemulihan yang masih berjalan, atau `null` kalau tidak ada yang jalan. */
export function ujiSedangBerjalan(riwayat: UjiPemulihan[]) {
  return palingBaru(riwayat.filter((uji) => uji.status === "berjalan"));
}

export type KesegaranUjiPemulihan = {
  tingkat: "belum-pernah" | "terbaru" | "perlu-diulang";
  /** Label pendek yang ditampilkan sebagai nilainya. */
  label: string;
  /** Satu kalimat penjelas: apa artinya bagi pemilik bimbel. */
  keterangan: string;
};

/**
 * Menilai kesegaran bukti uji pemulihan terakhir: belum pernah diuji, masih
 * dalam selang anjuran, atau sudah waktunya diulang. Masukannya waktu uji
 * terakhir yang berhasil (`ujiTerakhirBerhasil`), supaya halaman dan pemanggil
 * lain menilai dari angka yang sama.
 */
export function kesegaranUjiPemulihan(
  mulai: Date | null,
  { jedaHari = JEDA_UJI_HARI, sekarang = new Date() } = {},
): KesegaranUjiPemulihan {
  if (!mulai)
    return {
      tingkat: "belum-pernah",
      label: "Belum pernah diuji",
      keterangan:
        "Backup yang belum pernah dipulihkan belum bisa diandalkan. Uji di lingkungan percobaan, bukan produksi, lalu catat hasilnya.",
    };

  const umurHari = Math.floor(
    (sekarang.getTime() - mulai.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (umurHari > jedaHari)
    return {
      tingkat: "perlu-diulang",
      label: "Perlu diuji ulang",
      keterangan: `Uji pemulihan terakhir sudah ${umurHari} hari lalu, sedangkan uji ulang dianjurkan setiap ${jedaHari} hari.`,
    };

  return {
    tingkat: "terbaru",
    label: "Masih berlaku",
    keterangan: `Uji pemulihan dijalankan ${
      umurHari <= 0 ? "hari ini" : `${umurHari} hari lalu`
    }, masih dalam selang uji ulang ${jedaHari} hari.`,
  };
}
