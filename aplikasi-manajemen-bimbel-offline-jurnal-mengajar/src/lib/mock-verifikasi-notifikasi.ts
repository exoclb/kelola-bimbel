// Data tiruan untuk halaman ringkasan verifikasi notifikasi.
//
// Halaman `/app/notifikasi/verifikasi` memakainya sebagai pengganti laporan
// pemeriksaan yang datang dari server: belum ada endpoint yang mengembalikan
// hasil pemeriksaan, jadi daftar dan angkanya ditulis tetap di sini. Yang
// diperiksa bukan karangan — setiap perilaku di bawah sudah dikunci tes
// (`e2e/notifikasi.spec.ts`, `tests/notifikasi-service.test.mjs`,
// `tests/notifikasi-gaji.test.mjs`, `tests/pesan-notifikasi.test.mjs`), dan
// sumber pemicunya ikut ditulis supaya bisa ditelusuri.
//
// Dua temuan yang sengaja ditampilkan apa adanya: jenis `kelas_kosong` sudah
// terdaftar di preferensi tetapi belum punya pemicu, dan pengiriman surel
// masih dicatat ke log server karena belum ada penyedia email.

import { JENIS_NOTIFIKASI, type JenisNotifikasi } from "@/lib/notifikasi";

export type StatusVerifikasi = "lulus" | "perlu-ditinjau" | "belum-diperiksa";

/** Keterangan status untuk lencana di halaman. */
export const LABEL_STATUS_VERIFIKASI: Record<StatusVerifikasi, string> = {
  lulus: "Lulus",
  "perlu-ditinjau": "Perlu ditinjau",
  "belum-diperiksa": "Belum diperiksa",
};

export type KasusVerifikasi = {
  id: string;
  /** Nama pemeriksaan, memakai bahasa operasional bimbel. */
  judul: string;
  /** Perilaku yang dibuktikan. */
  keterangan: string;
  status: StatusVerifikasi;
  /** Jenis notifikasi yang ikut diperiksa; kosong kalau memeriksa penandaan baca. */
  jenis: JenisNotifikasi[];
  /** Kunci identitas peristiwa, mis. `rekap_honor:<guruId>:<periode>`. */
  kunci: string | null;
  /** Keadaan dan angka yang diamati saat pemeriksaan. */
  bukti: string[];
  /** Kesimpulan satu kalimat. */
  hasil: string;
  /** Letak pemicunya di kode, untuk penelusuran saat perlu ditinjau. */
  sumber: string;
};

export const KASUS_VERIFIKASI: KasusVerifikasi[] = [
  {
    id: "satu-peristiwa-satu-notifikasi",
    judul: "Satu peristiwa, satu notifikasi",
    keterangan:
      "Setiap peristiwa pemicu hanya boleh menghasilkan satu baris pemberitahuan, walau aksinya diulang atau dua permintaan datang bersamaan.",
    status: "lulus",
    jenis: ["rekap_honor", "laporan_bulanan"],
    kunci: "rekap_honor:<guruId>:<periode>",
    bukti: [
      "Rekap honor satu periode dibuat dua kali: tetap 1 notifikasi untuk gurunya.",
      "Laporan bulanan satu periode dibuka ulang: tetap 1 notifikasi untuk pemilik.",
      "Indeks unik `notifications_user_tipe_kunci_idx` menolak baris kembar (galat 23505).",
    ],
    hasil:
      "Peristiwa yang sama tidak pernah menambah pemberitahuan kedua, dijaga database dan bukan hanya pemeriksaan di aplikasi.",
    sumber:
      "src/services/notifikasi.service.ts · buatNotifikasi · drizzle/0031_notifikasi_kunci_idempoten.sql",
  },
  {
    id: "preferensi-menahan",
    judul: "Preferensi akun menahan notifikasi",
    keterangan:
      "Akun yang mematikan satu jenis di Preferensi Notifikasi tidak dikirimi jenis itu; akun yang belum pernah mengubah pengaturannya mengikuti bawaan jenis tersebut.",
    status: "lulus",
    jenis: ["jurnal_baru", "gaji_dibayar", "laporan_bulanan"],
    kunci: null,
    bukti: [
      "Pemilik yang mematikan `jurnal_baru`: 0 pemberitahuan walau jurnal tetap tersimpan.",
      "Guru yang mematikan `gaji_dibayar`: 0 pemberitahuan walau rekornya ditandai sudah dibayar.",
      "`laporan_bulanan` bawaannya mati, jadi pemilik hanya dikirimi setelah menyalakannya sendiri.",
    ],
    hasil:
      "Pemberitahuan baru sampai ke akun yang jenisnya menyala — bawaan jenis dipakai selama pengaturannya belum diubah.",
    sumber:
      "src/services/notifikasi.service.ts · penerimaNotifikasi · src/lib/notifikasi.ts",
  },
  {
    id: "tandai-dibaca",
    judul: "Tandai dibaca tetap bekerja",
    keterangan:
      "Menandai pemberitahuan sebagai dibaca mengubah jumlah belum dibaca, bisa dikembalikan, dan tidak pernah menyentuh pemberitahuan akun lain.",
    status: "lulus",
    jenis: [],
    kunci: null,
    bukti: [
      "Tandai satu pemberitahuan: jumlah belum dibaca turun tepat satu.",
      "Tandai ulang yang sudah dibaca: 0 baris berubah.",
      "Id pemberitahuan akun lain: 0 baris berubah.",
    ],
    hasil:
      "Penanda baca hanya bekerja pada pemberitahuan milik akun yang sedang masuk.",
    sumber: "PATCH /api/notifikasi · src/services/notifikasi.service.ts · tandaiNotifikasiDibaca",
  },
  {
    id: "aksi-berulang",
    judul: "Aksi berulang tidak menggandakan",
    keterangan:
      "Menyimpan ulang jurnal yang sama dan menandai ulang gaji yang sudah dibayar bukan peristiwa baru, jadi antrean pemberitahuan tidak bertambah.",
    status: "lulus",
    jenis: ["jurnal_baru", "gaji_dibayar"],
    kunci: "gaji_dibayar:<guruId>:<periode>",
    bukti: [
      "Jurnal yang sama dikirim ulang: tetap 1 pemberitahuan `jurnal_baru`.",
      "Status bayar ditandai ulang: tetap 1 pemberitahuan `gaji_dibayar`.",
      "Koreksi jurnal yang benar-benar berubah tidak mengabari lagi; yang dikabarkan hanya jurnal pertama.",
    ],
    hasil: "Hanya perubahan yang sungguh terjadi yang dikabarkan ke penerimanya.",
    sumber:
      "src/services/jurnal.service.ts · simpanJurnal · src/services/gaji.service.ts · tandaiPembayaranGaji",
  },
  {
    id: "jenis-tanpa-pemicu",
    judul: "Jenis notifikasi yang belum punya pemicu",
    keterangan:
      "Jenis `kelas_kosong` sudah muncul di daftar Preferensi Notifikasi, tetapi belum ada satu pun bagian aplikasi yang mengirimkannya.",
    status: "perlu-ditinjau",
    jenis: ["kelas_kosong"],
    kunci: null,
    bukti: [
      "Pencarian pemicu `kelas_kosong` di `src/` hanya menemukan katalog jenisnya.",
      "Akun bisa menyalakan jenis ini, tetapi tidak akan pernah menerima pemberitahuannya.",
    ],
    hasil:
      "Perlu diputuskan: dibuatkan pemicunya (mis. dari halaman pemantauan saat kelas belum diisi) atau jenisnya ditandai belum tersedia di pengaturan.",
    sumber: "src/lib/notifikasi.ts · JENIS_NOTIFIKASI",
  },
  {
    id: "kanal-luar",
    judul: "Pengiriman surel/WhatsApp",
    keterangan:
      "Pemberitahuan saat ini hanya masuk ke kotak notifikasi di aplikasi; pengiriman ke surel atau WhatsApp belum punya penyedia.",
    status: "belum-diperiksa",
    jenis: [],
    kunci: null,
    bukti: [
      "Belum ada penyedia email/WhatsApp yang terpasang di server.",
      "Pengiriman tautan atur ulang sandi masih dicatat ke log server, bukan dikirim.",
    ],
    hasil:
      "Verifikasi kanal luar menunggu penyedianya diisi lebih dulu; kotak notifikasi dalam aplikasi sudah bekerja tanpa itu.",
    sumber: "src/lib/auth.ts · docs/deploy-coolify.md · docs/backend.md",
  },
];

export type HasilUjiPeristiwa = {
  id: string;
  /** Peristiwa yang memicu pemberitahuan, dalam bahasa operasional. */
  peristiwa: string;
  jenis: JenisNotifikasi;
  /** Siapa yang menerima pemberitahuannya. */
  penerima: string;
  /** Kunci identitas peristiwa; `null` kalau dijaga dengan cara lain. */
  kunci: string | null;
  /** Cara baris kedua dicegah saat peristiwanya tidak punya kunci. */
  penjaga: string;
  /** Letak pemicunya di kode, untuk penelusuran. */
  pemicu: string;
  /** Nama tes yang mengunci perilaku peristiwa ini. */
  tes: string[];
};

//
// Setiap titik tulis yang benar-benar mengirim pemberitahuan, beserta tes yang
// mengunci perilakunya. Yang tidak ada di sini juga temuan: `kelas_kosong` belum
// punya pemicu sama sekali, dan kanal surel/WhatsApp belum punya penyedia.
export const PERISTIWA_UJI: HasilUjiPeristiwa[] = [
  {
    id: "jurnal-pertama",
    peristiwa: "Jurnal mengajar pertama kali masuk untuk jadwal hari itu",
    jenis: "jurnal_baru",
    penerima: "Pemilik/admin yang menyalakan jenisnya",
    kunci: null,
    penjaga:
      "Dijaga pemeriksaan jurnal yang sudah ada, bukan kunci: kirim ulang jurnal yang sama tidak menambah pemberitahuan.",
    pemicu: "src/services/jurnal.service.ts · simpanJurnal",
    tes: [
      "e2e/notifikasi.spec.ts · jurnal baru hanya memberi tahu pemilik yang masih mengaktifkannya",
    ],
  },
  {
    id: "rekap-honor-baru",
    peristiwa: "Rekap honor seorang guru untuk satu periode baru tercatat",
    jenis: "rekap_honor",
    penerima: "Guru yang bersangkutan",
    kunci: "rekap_honor:<guruId>:<periode>",
    penjaga: "Kunci per guru dan periode, ditopang indeks unik.",
    pemicu: "src/services/gaji.service.ts · tandaiPembayaranGaji",
    tes: [
      "tests/notifikasi-gaji.test.mjs · rekap honor periodik hanya memberi tahu sekali per periode",
      "tests/notifikasi-gaji.test.mjs · guru yang mematikan rekap_honor tidak dikirimi",
    ],
  },
  {
    id: "gaji-dibayar",
    peristiwa: "Status gaji satu periode berubah menjadi sudah dibayar",
    jenis: "gaji_dibayar",
    penerima: "Guru yang bersangkutan",
    kunci: "gaji_dibayar:<guruId>:<periode>",
    penjaga:
      "Kunci per guru dan periode, dan hanya dikirim saat statusnya benar-benar berubah.",
    pemicu: "src/services/gaji.service.ts · tandaiPembayaranGaji",
    tes: [
      "tests/notifikasi-gaji.test.mjs · tandai dibayar menambah notifikasi gaji sekali saja",
      "e2e/notifikasi.spec.ts · gaji dibayar memberi tahu gurunya sekali saja",
    ],
  },
  {
    id: "laporan-bulanan-selesai",
    peristiwa: "Angka laporan bulanan satu periode selesai dihitung",
    jenis: "laporan_bulanan",
    penerima: "Pemilik/admin yang menyalakan jenisnya (bawaannya mati)",
    kunci: "laporan_bulanan:<periode>",
    penjaga: "Kunci per periode, dan penerimanya wajib menyalakan jenisnya.",
    pemicu:
      "src/services/notifikasi.service.ts · beritahuLaporanBulanan · dipanggil halaman /app/laba-rugi",
    tes: [
      "tests/notifikasi-service.test.mjs · beritahuLaporanBulanan sekali per periode dan hanya untuk yang menyalakannya",
      "e2e/notifikasi.spec.ts · laporan bulanan memberitahu pemilik yang menyalakannya sekali per periode",
    ],
  },
];

export type RingkasanVerifikasi = {
  total: number;
  lulus: number;
  perluDitinjau: number;
  belumDiperiksa: number;
};

/** Hitungan per status, dipakai kartu ringkasan di halaman. */
export function ringkasVerifikasi(
  daftar: KasusVerifikasi[] = KASUS_VERIFIKASI,
): RingkasanVerifikasi {
  return {
    total: daftar.length,
    lulus: daftar.filter((kasus) => kasus.status === "lulus").length,
    perluDitinjau: daftar.filter((kasus) => kasus.status === "perlu-ditinjau")
      .length,
    belumDiperiksa: daftar.filter((kasus) => kasus.status === "belum-diperiksa")
      .length,
  };
}

/** Judul jenis notifikasi dari katalog, mis. `rekap_honor` → "Rekap honor guru". */
export function judulJenisNotifikasi(jenis: JenisNotifikasi) {
  return (
    JENIS_NOTIFIKASI.find((item) => item.jenis === jenis)?.judul ?? jenis
  );
}
