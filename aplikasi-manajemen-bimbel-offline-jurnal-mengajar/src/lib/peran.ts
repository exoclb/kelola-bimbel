// Peran pengguna dan halaman utama tiap peran.
//
// Peran sungguhan disimpan di kolom `user.role` (Better Auth). Untuk tampilan,
// owner dan admin diperlakukan sama karena keduanya boleh memantau bimbel.
// Isinya fungsi murni, jadi aman dipakai komponen server maupun klien.

export type PeranPengguna = "guru" | "owner" | "orang-tua";

/** Nama peran untuk ditampilkan, mis. di lencana pengguna. */
export function labelPeran(peran: PeranPengguna): string {
  if (peran === "owner") return "Owner";
  if (peran === "orang-tua") return "Orang tua";
  return "Guru";
}

/**
 * Membaca peran dari kolom `user.role`. Kolom itu boleh berisi beberapa peran
 * dipisah koma ("admin,support"), dan untuk tampilan owner maupun admin
 * sama-sama dilihat sebagai owner karena keduanya boleh memantau bimbel.
 * Akun yang punya peran owner/admin tetap dianggap owner walaupun juga
 * tertaut sebagai wali, sedangkan peran `orang-tua` hanya membuka portal wali.
 */
export function peranDariRole(role: string | null | undefined): PeranPengguna {
  const daftar = (role ?? "")
    .split(",")
    .map((nilai) => nilai.trim().toLowerCase());
  if (daftar.includes("owner") || daftar.includes("admin")) return "owner";
  if (daftar.includes("orang-tua")) return "orang-tua";
  return "guru";
}

/**
 * Halaman yang dibuka setelah masuk: guru langsung ke jurnal hari ini (tugas
 * utamanya), owner ke pemantauan harian, dan wali ke portal orang tua. Beranda
 * `/app` tetap bisa dibuka lewat menu.
 */
export function homePathUntukPeran(peran: PeranPengguna): string {
  if (peran === "owner") return "/app/pemantauan";
  if (peran === "orang-tua") return "/portal";
  return "/app/jurnal";
}
