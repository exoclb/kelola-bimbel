// Mode rilis aplikasi (Fase 2 roadmap: "Saklar Mode Rilis").
//
// Aplikasi punya dua wajah: saat dikembangkan, halaman contoh bawaan starter
// boleh tampil sebagai acuan tampilan; saat dirilis ke bimbel, halaman contoh
// beserta tautannya harus hilang. Dulu penandanya menumpang `NODE_ENV` saja,
// sehingga salinan yang dijalankan dengan `next start` (mis. untuk meninjau
// hasil rilis) selalu menyembunyikan halaman contoh. Operator kini bisa
// menentukannya sendiri lewat variabel `MODE_RILIS` tanpa mengubah mode build:
// isi `false` untuk tetap membuka halaman contoh di server rilis, atau `true`
// untuk menyembunyikannya di server pengembangan.
//
// Berkas ini hanya MEMBACA dan MEMERIKSA — ia tidak pernah melempar galat,
// sama seperti src/lib/smtp.ts. Isian yang keliru dilaporkan lewat `keterangan`
// dan `variabelBermasalah`, bukan dengan menghentikan aplikasi, supaya bisa
// muncul di halaman status lingkungan dan penerapan tetap jalan dengan
// perilaku cadangan (mengikuti NODE_ENV).
//
// Modul ini adalah satu-satunya pembaca mode rilis: saklar halaman contoh
// (`src/lib/halaman-contoh.ts`) dan halaman status lingkungan memakainya, jadi
// cukup satu tempat yang berubah kalau aturannya bergeser.
//
// Sengaja tanpa impor berawalan "@/" supaya bisa diuji langsung `node --test`.

/** Nama variabel lingkungan yang dibaca modul ini. */
export const VARIABEL_MODE_RILIS = "MODE_RILIS";

const NILAI_BENAR = ["true", "1", "ya", "yes", "on"];
const NILAI_SALAH = ["false", "0", "tidak", "no", "off"];

/** Dari mana keputusan mode rilis diambil. */
export type SumberModeRilis = "variabel" | "node-env";

export type StatusModeRilis = {
  /**
   * true = rilis: halaman contoh beserta tautan menunya disembunyikan.
   * false = pengembangan: halaman contoh tetap terjangkau.
   */
  rilis: boolean;
  /** "variabel" kalau MODE_RILIS berisi, "node-env" kalau mengikuti NODE_ENV. */
  sumber: SumberModeRilis;
  /** Kalimat siap tampil di halaman status lingkungan/log. Tanpa rahasia. */
  keterangan: string;
  /** Isian MODE_RILIS yang tidak dikenali; kosong kalau isiannya sah. */
  variabelBermasalah: string[];
};

/**
 * Baca mode rilis dari variabel lingkungan.
 *
 * Aturan isian (sama dengan komentar di .env.example):
 * - `MODE_RILIS` kosong → mengikuti `NODE_ENV`: production berarti rilis.
 *   Tanpa penanda apa pun (mis. skrip biasa) aplikasi dianggap belum rilis.
 * - `MODE_RILIS` berisi true/false (1/0, ya/tidak, yes/no, on/off) → menang
 *   atas `NODE_ENV`, jadi salinan dev dan salinan rilis bisa diatur terpisah.
 * - Nilai lain → dianggap keliru: dilaporkan lewat `variabelBermasalah`, dan
 *   perilakunya kembali mengikuti `NODE_ENV` supaya penerapan tetap aman.
 */
export function bacaModeRilis(
  sumber: NodeJS.ProcessEnv = process.env,
): StatusModeRilis {
  const isian = (sumber[VARIABEL_MODE_RILIS] ?? "").trim().toLowerCase();
  const dariNode = sumber.NODE_ENV === "production";

  if (NILAI_BENAR.includes(isian))
    return {
      rilis: true,
      sumber: "variabel",
      keterangan:
        "Mode rilis dinyalakan lewat MODE_RILIS; halaman contoh disembunyikan.",
      variabelBermasalah: [],
    };

  if (NILAI_SALAH.includes(isian))
    return {
      rilis: false,
      sumber: "variabel",
      keterangan:
        "Mode rilis dimatikan lewat MODE_RILIS; halaman contoh tetap terjangkau.",
      variabelBermasalah: [],
    };

  if (isian)
    return {
      rilis: dariNode,
      sumber: "node-env",
      keterangan:
        "MODE_RILIS harus true atau false (dikosongkan pun boleh); untuk sementara mode rilis mengikuti NODE_ENV.",
      variabelBermasalah: [VARIABEL_MODE_RILIS],
    };

  return {
    rilis: dariNode,
    sumber: "node-env",
    keterangan: dariNode
      ? "Tanpa MODE_RILIS, mode rilis mengikuti NODE_ENV=production."
      : "Tanpa MODE_RILIS, halaman contoh tetap terjangkau karena NODE_ENV bukan production.",
    variabelBermasalah: [],
  };
}

/**
 * Pintasan untuk pemanggil yang hanya perlu tahu rilis atau tidak. Dipakai
 * saklar halaman contoh dan bisa dipakai untuk menyembunyikan bagian lain yang
 * hanya cocok dilihat saat pengembangan.
 */
export function modeRilisAktif(
  sumber: NodeJS.ProcessEnv = process.env,
): boolean {
  return bacaModeRilis(sumber).rilis;
}
