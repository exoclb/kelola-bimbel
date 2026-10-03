// Peran pengguna dan halaman utama tiap peran.
//
// Peran sungguhan disimpan di kolom `user.role` (Better Auth). Untuk tampilan,
// owner dan admin diperlakukan sama karena keduanya boleh memantau bimbel.
// Isinya fungsi murni, jadi aman dipakai komponen server maupun klien.

export type PeranPengguna = "guru" | "owner";

/** Nama peran untuk ditampilkan, mis. di lencana pengguna. */
export function labelPeran(peran: PeranPengguna): string {
  return peran === "owner" ? "Owner" : "Guru";
}

/**
 * Membaca peran dari kolom `user.role`. Kolom itu boleh berisi beberapa peran
 * dipisah koma ("admin,support"), dan untuk tampilan owner maupun admin
 * sama-sama dilihat sebagai owner karena keduanya boleh memantau bimbel.
 */
export function peranDariRole(role: string | null | undefined): PeranPengguna {
  const daftar = (role ?? "")
    .split(",")
    .map((nilai) => nilai.trim().toLowerCase());
  return daftar.includes("owner") || daftar.includes("admin")
    ? "owner"
    : "guru";
}

/**
 * Halaman yang dibuka setelah masuk: guru langsung ke jurnal hari ini (tugas
 * utamanya), owner ke pemantauan harian. Beranda `/app` tetap bisa dibuka
 * lewat menu.
 */
export function homePathUntukPeran(peran: PeranPengguna): string {
  return peran === "owner" ? "/app/pemantauan" : "/app/jurnal";
}
