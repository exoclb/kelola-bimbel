// Data tiruan untuk halaman ringkasan verifikasi notifikasi.
//
// Halaman `/app/notifikasi/verifikasi` memakainya sebagai pengganti laporan
// pemeriksaan yang datang dari server: belum ada endpoint yang mengembalikan
// hasil pemeriksaan, jadi daftar dan angkanya ditulis tetap di sini. Yang
// diperiksa bukan karangan — setiap perilaku di bawah sudah dikunci tes
// (`e2e/notifikasi.spec.ts`, `tests/notifikasi-service.test.mjs`,
// `tests/notifikasi-tandai-dibaca.test.mjs`,
// `tests/notifikasi-anti-duplikat.test.mjs`, `tests/notifikasi-gaji.test.mjs`,
// `tests/notifikasi-tagihan.test.mjs`, `tests/pesan-notifikasi.test.mjs`), dan
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
    jenis: ["rekap_honor", "tagihan_terbit", "laporan_bulanan"],
    kunci: "rekap_honor:<guruId>:<periode> · tagihan:<idTagihan>",
    bukti: [
      "Rekap honor satu periode dibuat dua kali: tetap 1 notifikasi untuk gurunya.",
      "Tagihan SPP satu periode diterbitkan dua kali: tetap 1 notifikasi untuk walinya.",
      "Laporan bulanan satu periode dibuka ulang: tetap 1 notifikasi untuk pemilik.",
      "Peristiwa yang sama dikirim dua permintaan serentak: tetap 1 notifikasi untuk penerimanya.",
      "Indeks unik notifications_user_tipe_kunci_idx menolak baris kembar (galat 23505).",
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
    jenis: ["jurnal_baru", "gaji_dibayar", "laporan_bulanan", "tagihan_terbit"],
    kunci: null,
    bukti: [
      "Pemilik yang mematikan jenis jurnal_baru: 0 pemberitahuan walau jurnal tetap tersimpan.",
      "Guru yang mematikan jenis gaji_dibayar: 0 pemberitahuan walau rekornya ditandai sudah dibayar.",
      "Wali yang mematikan jenis tagihan_terbit: 0 pemberitahuan walau tagihan anaknya terbit; walinya yang belum mengubah pengaturan tetap menerima.",
      "Jenis laporan_bulanan bawaannya mati, jadi pemilik hanya dikirimi setelah menyalakannya sendiri.",
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
    jenis: ["jurnal_baru", "gaji_dibayar", "tagihan_lunas"],
    kunci: "gaji_dibayar:<guruId>:<periode> · tagihan:<idTagihan>:lunas",
    bukti: [
      "Jurnal yang sama dikirim ulang: tetap 1 pemberitahuan jenis jurnal_baru.",
      "Status bayar ditandai ulang: tetap 1 pemberitahuan jenis gaji_dibayar.",
      "Tagihan ditandai lunas dua kali: tetap 1 pemberitahuan jenis tagihan_lunas.",
      "Koreksi jurnal yang benar-benar berubah tidak mengabari lagi; yang dikabarkan hanya jurnal pertama.",
    ],
    hasil: "Hanya perubahan yang sungguh terjadi yang dikabarkan ke penerimanya.",
    sumber:
      "src/services/jurnal.service.ts · simpanJurnal · src/services/gaji.service.ts · tandaiPembayaranGaji · src/services/tagihan.service.ts · updateTagihan",
  },
  {
    id: "jenis-tanpa-pemicu",
    judul: "Jenis notifikasi yang belum punya pemicu",
    keterangan:
      "Jenis kelas_kosong sudah muncul di daftar Preferensi Notifikasi, tetapi belum ada satu pun bagian aplikasi yang mengirimkannya.",
    status: "perlu-ditinjau",
    jenis: ["kelas_kosong"],
    kunci: null,
    bukti: [
      "Pencarian pemicu kelas_kosong di src/ hanya menemukan katalog jenisnya.",
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
      "tests/notifikasi-anti-duplikat.test.mjs · rekap honor yang dipicu bersamaan mengabari sekali per jenis",
      "e2e/notifikasi.spec.ts · rekap honor memberi tahu gurunya sekali per periode",
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
      "tests/notifikasi-anti-duplikat.test.mjs · rekap honor yang dipicu bersamaan mengabari sekali per jenis",
      "e2e/notifikasi.spec.ts · gaji dibayar memberi tahu gurunya sekali saja",
    ],
  },
  {
    id: "tagihan-spp-terbit",
    peristiwa: "Tagihan SPP satu murid untuk satu periode benar-benar terbit",
    jenis: "tagihan_terbit",
    penerima: "Semua akun wali yang tertaut ke murid itu",
    kunci: "tagihan:<idTagihan>",
    penjaga:
      "Kunci per tagihan, ditopang indeks unik. Tagihan yang sudah ada dilewati indeks (murid + periode), jadi tidak dikabarkan lagi.",
    pemicu: "src/services/tagihan.service.ts · createTagihan",
    tes: [
      "tests/notifikasi-tagihan.test.mjs · tagihan terbit mengabari wali muridnya sekali",
      "tests/notifikasi-tagihan.test.mjs · semua wali satu murid dikabari tagihan terbitnya",
      "tests/notifikasi-anti-duplikat.test.mjs · tagihan yang diterbitkan bersamaan tetap satu tagihan dan satu kabar",
    ],
  },
  {
    id: "tagihan-spp-lunas",
    peristiwa: "Status tagihan SPP satu murid berubah menjadi lunas",
    jenis: "tagihan_lunas",
    penerima: "Semua akun wali yang tertaut ke murid itu",
    kunci: "tagihan:<idTagihan>:lunas",
    penjaga:
      "Kunci per tagihan yang terpisah dari kunci penerbitannya; hanya dikirim saat statusnya benar-benar lunas.",
    pemicu: "src/services/tagihan.service.ts · updateTagihan",
    tes: [
      "tests/notifikasi-tagihan.test.mjs · tagihan lunas mengabari wali sekali saja",
      "tests/notifikasi-anti-duplikat.test.mjs · tagihan yang ditandai lunas bersamaan mengabari sekali",
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
      "tests/notifikasi-anti-duplikat.test.mjs · laporan bulanan yang dihitung ulang bersamaan tetap satu kabar",
      "e2e/notifikasi.spec.ts · laporan bulanan memberitahu pemilik yang menyalakannya sekali per periode",
    ],
  },
];

export type UjiPreferensi = {
  id: string;
  jenis: JenisNotifikasi;
  /** Keadaan pengaturan yang diuji. */
  keadaan: string;
  /** Akibatnya pada pemberitahuan yang sampai. */
  hasil: string;
  /** Nama tes yang mengunci perilaku ini. */
  tes: string;
};

// Preferensi diuji per akun dan per jenis: mematikan satu jenis tidak menahan
// jenis lain, bawaan jenis dipakai selama akun belum mengubahnya, dan jenis yang
// dinyalakan kembali mengabari peristiwa berikutnya.
export const UJI_PREFERENSI: UjiPreferensi[] = [
  {
    id: "jurnal-baru-dimatikan",
    jenis: "jurnal_baru",
    keadaan:
      "Pemilik mematikan jenis ini, lalu gurunya tetap mengirim jurnal mengajar.",
    hasil:
      "Pemilik itu tidak dikirimi pemberitahuan walau jurnalnya tersimpan, sedangkan pemilik lain yang masih menyalakannya tetap diberi tahu.",
    tes: "e2e/notifikasi.spec.ts · jurnal baru hanya memberi tahu pemilik yang masih mengaktifkannya",
  },
  {
    id: "jurnal-baru-dinyalakan-kembali",
    jenis: "jurnal_baru",
    keadaan:
      "Pemilik mematikan jenis ini dari halaman Preferensi Notifikasi, satu jurnal masuk, lalu saklarnya dinyalakan lagi dari halaman yang sama.",
    hasil:
      "Selama saklarnya mati tidak ada kabar sama sekali; setelah dinyalakan, jurnal berikutnya dikabari lagi tepat satu. Jurnal yang terjadi selagi mati tidak dikabarkan menyusul, karena jurnal yang sama hanya memicu kabar saat pertama kali masuk.",
    tes: "tests/notifikasi-jurnal.test.mjs · menyalakan kembali jenis jurnal_baru mengabari peristiwa berikutnya · e2e/notifikasi.spec.ts · preferensi yang dinyalakan kembali menerima kabar berikutnya",
  },
  {
    id: "rekap-honor-dimatikan",
    jenis: "rekap_honor",
    keadaan:
      "Guru mematikan jenis ini, lalu rekapitulasi honornya dicatat untuk satu periode.",
    hasil:
      "Pemberitahuan rekapnya 0, tetapi jenis gaji_dibayar untuk periode yang sama tetap sampai karena preferensinya per jenis. Penerima yang ditahan juga tidak dihitung sebagai baris yang dibuat.",
    tes: "tests/notifikasi-gaji.test.mjs · guru yang mematikan rekap_honor tidak dikirimi · tests/notifikasi-service.test.mjs · buatNotifikasi menghormati preferensi akun yang mematikan jenisnya · tests/notifikasi-service.test.mjs · kunci peristiwa baru terpakai setelah preferensinya dinyalakan · e2e/notifikasi.spec.ts · rekap honor memberi tahu gurunya sekali per periode",
  },
  {
    id: "gaji-dibayar-dimatikan",
    jenis: "gaji_dibayar",
    keadaan:
      "Guru mematikan jenis ini, lalu rekornya ditandai sudah dibayar oleh pemilik.",
    hasil:
      "Guru itu tidak menerima pemberitahuannya, sementara guru lain yang tidak mengubah pengaturannya menerima tepat satu — walau pembayarannya ditandai dua kali.",
    tes: "e2e/notifikasi.spec.ts · gaji dibayar memberi tahu gurunya sekali saja",
  },
  {
    id: "tagihan-terbit-tanpa-hubungan",
    jenis: "tagihan_terbit",
    keadaan:
      "Tagihan diterbitkan oleh pemilik untuk murid yang belum punya akun wali, lalu untuk murid yang walinya mematikan jenis ini.",
    hasil:
      "Pemilik dan admin yang menerbitkannya tidak ikut dikirimi — penerimanya hanya wali murid. Murid tanpa wali tetap terbit tagihannya tanpa pemberitahuan, dan wali yang mematikannya menerima 0.",
    tes: "tests/notifikasi-tagihan.test.mjs · murid tanpa wali tetap diterbitkan tanpa pemberitahuan · tests/notifikasi-tagihan.test.mjs · pemilik dan admin tidak dikirimi pemberitahuan tagihan",
  },
  {
    id: "tagihan-lunas-dimatikan",
    jenis: "tagihan_lunas",
    keadaan:
      "Wali mematikan jenis ini, lalu tagihan anaknya ditandai lunas oleh pemilik.",
    hasil:
      "Wali itu tidak menerima pemberitahuannya, sementara wali lain yang tidak mengubah pengaturannya menerima tepat satu — walau pelunasannya ditandai dua kali.",
    tes: "tests/notifikasi-tagihan.test.mjs · wali yang mematikan kabar tagihan tidak dikirimi",
  },
  {
    id: "laporan-bulanan-mati-bawaan",
    jenis: "laporan_bulanan",
    keadaan:
      "Jenis ini bawaannya mati; pemilik yang membiarkan pengaturannya dibandingkan yang menyalakannya.",
    hasil:
      "Hanya pemilik yang menyalakannya yang menerima laporan, sekali per periode walau halamannya dibuka berulang kali.",
    tes: "tests/notifikasi-service.test.mjs · beritahuLaporanBulanan sekali per periode dan hanya untuk yang menyalakannya · e2e/notifikasi.spec.ts · laporan bulanan memberitahu pemilik yang menyalakannya sekali per periode",
  },
];

export type UjiTandaiDibaca = {
  id: string;
  /** Permintaan yang dikirim ke `PATCH /api/notifikasi`. */
  langkah: string;
  /** Yang benar-benar berubah di baris notifikasi. */
  hasil: string;
  /** Nama tes yang mengunci perilaku ini. */
  tes: string;
};

// Penandaan baca diuji sampai batas kepemilikan barisnya: penyaring akun
// dipakai satu perintah SQL yang sama dengan pembacaannya.
export const UJI_TANDAI_DIBACA: UjiTandaiDibaca[] = [
  {
    id: "satu-id",
    langkah: "ids: [<id milik sendiri>]",
    hasil:
      "1 baris berubah dan hitungan belum dibaca akun itu turun jadi 0.",
    tes: "tests/notifikasi-tandai-dibaca.test.mjs · tandaiNotifikasiDibaca mengubah status baris dan menurunkan hitungan belum dibaca · e2e/notifikasi.spec.ts · daftar dan tandai baca notifikasi terbatas pada akun sendiri",
  },
  {
    id: "dibalik",
    langkah: "ids: [<id sudah dibaca>], dibaca: false",
    hasil:
      "1 baris berubah kembali menjadi belum dibaca — penandaan bisa dibalik.",
    tes: "tests/notifikasi-tandai-dibaca.test.mjs · penandaan baca bisa dibalik dan mengulang aksi yang sama tidak mengubah baris · e2e/notifikasi.spec.ts · daftar dan tandai baca notifikasi terbatas pada akun sendiri",
  },
  {
    id: "id-akun-lain",
    langkah: "ids: [<id akun lain>]",
    hasil:
      "0 baris berubah; pemberitahuan akun lain tetap utuh miliknya.",
    tes: "tests/notifikasi-tandai-dibaca.test.mjs · penandaan baca tidak menyentuh baris akun lain · e2e/notifikasi.spec.ts · daftar dan tandai baca notifikasi terbatas pada akun sendiri · penandaan baca akun lain tidak mengubah notifikasi milik sendiri",
  },
  {
    id: "semua",
    langkah: "semua: true",
    hasil:
      "Hanya baris milik akun yang sedang masuk yang berubah; akun lain tetap melihat 1 belum dibaca.",
    tes: "tests/notifikasi-tandai-dibaca.test.mjs · penandaan baca tidak menyentuh baris akun lain · e2e/notifikasi.spec.ts · penandaan baca akun lain tidak mengubah notifikasi milik sendiri",
  },
  {
    id: "badan-kosong",
    langkah: "ids: []",
    hasil:
      "Dijawab 422 sebelum menyentuh basis data, bukan menandai semua baris.",
    tes: "e2e/notifikasi.spec.ts · daftar dan tandai baca notifikasi terbatas pada akun sendiri",
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
