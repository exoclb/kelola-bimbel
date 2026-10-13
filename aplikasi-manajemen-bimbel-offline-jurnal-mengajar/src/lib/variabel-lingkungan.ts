import "server-only";

// Daftar variabel lingkungan yang dipakai aplikasi, plus pemeriksa
// keberadaannya. Modul ini sengaja hanya berjalan di server: yang keluar dari
// sini cuma nama variabel dan boolean "terpasang / belum", tidak pernah
// nilainya. Jangan pernah menambahkan nilai ke tipe kembaliannya — halaman
// status akan mengirim hasilnya apa adanya ke peramban.
//
// Kategori:
// - wajib    : aplikasi tidak bisa jalan (auth atau database mati) tanpa ini.
// - opsional : hanya menambah kenyamanan penyiapan/migrasi atau kanal email;
//              bawaannya aman (aplikasi tetap jalan tanpa ini).
// - otomatis : diisi kerangka kerja atau platform, bukan oleh operator.

export type KategoriVariabelLingkungan = "wajib" | "opsional" | "otomatis";

export type MetadataVariabelLingkungan = {
  nama: string;
  kategori: KategoriVariabelLingkungan;
  /** Satu baris, bahasa Indonesia, tanpa membocorkan nilai variabelnya. */
  keterangan: string;
  /** Kategori "otomatis": siapa yang mengisinya. */
  pengisi?: string;
};

export const VARIABEL_LINGKUNGAN: readonly MetadataVariabelLingkungan[] = [
  {
    nama: "BETTER_AUTH_SECRET",
    kategori: "wajib",
    keterangan:
      "Kunci penandatanganan sesi dan cookie login. Dibuat npm run setup, minimal 32 karakter.",
  },
  {
    nama: "BETTER_AUTH_URL",
    kategori: "wajib",
    keterangan:
      "Alamat asal aplikasi yang dipakai Better Auth. Di pengembangan ada bawaannya, di produksi wajib diisi.",
  },
  {
    nama: "DATABASE_URL",
    kategori: "wajib",
    keterangan:
      "Alamat koneksi PostgreSQL utama tempat seluruh data bimbel disimpan.",
  },
  {
    nama: "MIGRATION_DATABASE_URL",
    kategori: "opsional",
    keterangan:
      "Koneksi langsung ke PostgreSQL untuk migrasi kalau DATABASE_URL lewat pooler.",
  },
  // Kanal email pengirim (Fase 1 roadmap). Semuanya opsional: selama belum
  // diisi, tautan atur ulang sandi tetap dicatat ke log server. Diperiksa
  // src/lib/smtp.ts — halaman status hanya menampilkan terpasang/belum.
  {
    nama: "SMTP_HOST",
    kategori: "opsional",
    keterangan:
      "Alamat server SMTP pengirim email. Kalau kosong, fitur email mati dan tautan atur ulang sandi cukup dicatat ke log server.",
  },
  {
    nama: "SMTP_PORT",
    kategori: "opsional",
    keterangan:
      "Port server SMTP; bawaannya 587 (STARTTLS). Port 465 memakai TLS sejak awal koneksi.",
  },
  {
    nama: "SMTP_SECURE",
    kategori: "opsional",
    keterangan:
      "Paksa mode TLS: true atau false. Kalau kosong, nilainya ditentukan dari port (465 berarti true).",
  },
  {
    nama: "SMTP_USER",
    kategori: "opsional",
    keterangan:
      "Nama pengguna autentikasi SMTP; harus diisi bersama SMTP_PASSWORD.",
  },
  {
    nama: "SMTP_PASSWORD",
    kategori: "opsional",
    keterangan:
      "Sandi autentikasi SMTP. Rahasia: hanya diisi di pengaturan lingkungan, jangan di berkas repo.",
  },
  {
    nama: "SMTP_FROM",
    kategori: "opsional",
    keterangan: "Alamat pengirim pada email; kalau kosong memakai SMTP_USER.",
  },
  {
    nama: "SMTP_FROM_NAME",
    kategori: "opsional",
    keterangan:
      "Nama tampilan pengirim pada kotak masuk penerima; kosong berarti hanya alamatnya yang tampil.",
  },
  {
    nama: "POSTGRES_USER",
    kategori: "opsional",
    keterangan:
      "Nama pengguna container PostgreSQL lokal yang disiapkan npm run db:up.",
  },
  {
    nama: "POSTGRES_PASSWORD",
    kategori: "opsional",
    keterangan:
      "Sandi container PostgreSQL lokal. Diisi otomatis saat penyiapan pertama.",
  },
  {
    nama: "POSTGRES_DB",
    kategori: "opsional",
    keterangan: "Nama basis data container PostgreSQL lokal.",
  },
  {
    nama: "POSTGRES_PORT",
    kategori: "opsional",
    keterangan:
      "Port tetap container PostgreSQL lokal; kalau kosong, port bebas dipilih otomatis.",
  },
  {
    nama: "COMPOSE_PROJECT_NAME",
    kategori: "opsional",
    keterangan:
      "Awalan nama container Docker Compose, supaya beberapa salinan proyek tidak bentrok.",
  },
  // Saklar mode rilis (Fase 2 roadmap). Opsional: kalau kosong, mode rilis
  // mengikuti NODE_ENV. Dipakai src/lib/mode-rilis.ts — saklar halaman contoh
  // di src/lib/halaman-contoh.ts membacanya lewat util itu. Halaman status
  // hanya menampilkan terpasang/belum, tidak nilainya.
  {
    nama: "MODE_RILIS",
    kategori: "opsional",
    keterangan:
      "Penanda mode rilis: true menyembunyikan halaman contoh, false menampilkannya. Kalau kosong, mengikuti NODE_ENV (production berarti rilis).",
  },
  {
    nama: "NODE_ENV",
    kategori: "otomatis",
    pengisi: "Next.js",
    keterangan:
      "Penanda mode jalan (development/production) yang menentukan perilaku pengembangan.",
  },
  {
    nama: "STARTER_TEST_RUN",
    kategori: "otomatis",
    pengisi: "harness uji",
    keterangan:
      "Penanda berkas uji e2e; kalau terisi, batas laju login dimatikan sementara.",
  },
  {
    nama: "COOLIFY_URL",
    kategori: "otomatis",
    pengisi: "Coolify",
    keterangan: "Alamat panel Coolify yang dipakai skrip penyiapan basis data.",
  },
  {
    nama: "COOLIFY_TOKEN",
    kategori: "otomatis",
    pengisi: "Coolify",
    keterangan: "Token akses API Coolify untuk skrip penyiapan basis data.",
  },
  {
    nama: "COOLIFY_PROJECT_UUID",
    kategori: "otomatis",
    pengisi: "Coolify",
    keterangan: "Penanda proyek Coolify tempat basis data dikelola.",
  },
  {
    nama: "COOLIFY_SERVER_UUID",
    kategori: "otomatis",
    pengisi: "Coolify",
    keterangan: "Penanda server Coolify tempat proyek ini berjalan.",
  },
  {
    nama: "COOLIFY_DB_NAME",
    kategori: "otomatis",
    pengisi: "Coolify",
    keterangan: "Nama basis data yang diminta ke layanan basis data Coolify.",
  },
  {
    nama: "COOLIFY_ENVIRONMENT",
    kategori: "otomatis",
    pengisi: "Coolify",
    keterangan:
      "Nama lingkungan Coolify (mis. production) untuk penyiapan basis data.",
  },
];

export type KondisiVariabelLingkungan = MetadataVariabelLingkungan & {
  /** Hanya keberadaan nilainya — nilainya sendiri tidak pernah diteruskan. */
  terpasang: boolean;
};

export type RingkasanVariabelLingkungan = {
  jumlah: number;
  terpasang: number;
  wajib: number;
  wajibTerpasang: number;
  wajibBelumTerpasang: number;
};

/**
 * Periksa keberadaan tiap variabel. Nilai hanya dipakai untuk menghitung
 * boolean, jadi rahasianya tidak ikut ke mana-mana.
 */
export function bacaKondisiVariabelLingkungan(
  sumber: NodeJS.ProcessEnv = process.env,
): KondisiVariabelLingkungan[] {
  return VARIABEL_LINGKUNGAN.map((variabel) => ({
    ...variabel,
    terpasang: Boolean(sumber[variabel.nama]?.trim()),
  }));
}

/** Hitungan untuk ringkasan di atas daftar. */
export function ringkasKondisiVariabelLingkungan(
  daftar: readonly KondisiVariabelLingkungan[],
): RingkasanVariabelLingkungan {
  const wajib = daftar.filter((variabel) => variabel.kategori === "wajib");
  const wajibTerpasang = wajib.filter((variabel) => variabel.terpasang).length;
  return {
    jumlah: daftar.length,
    terpasang: daftar.filter((variabel) => variabel.terpasang).length,
    wajib: wajib.length,
    wajibTerpasang,
    wajibBelumTerpasang: wajib.length - wajibTerpasang,
  };
}
