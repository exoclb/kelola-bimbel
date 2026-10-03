// Pembantu format tanggal berbahasa Indonesia. Dipakai bersama oleh halaman
// jurnal, riwayat, dan fitur lain supaya tampilannya seragam.

/** Tanggal lokal dalam bentuk `YYYY-MM-DD`. */
export function tanggalISO(tanggal: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tanggal);
}

/** Nama hari, misalnya "Sabtu". */
export function namaHari(tanggal: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(tanggal);
}

/** Tanggal lengkap, misalnya "Sabtu, 3 Oktober 2026". */
export function formatTanggalLengkap(tanggal: Date | string) {
  const nilai =
    typeof tanggal === "string" ? new Date(`${tanggal}T00:00:00`) : tanggal;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(nilai);
}
