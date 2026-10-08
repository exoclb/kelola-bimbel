// Pencocokan tab bawah Portal Wali dengan alamat halaman yang sedang dibuka.
//
// Tab aktif bukan hanya yang alamatnya sama persis: halaman anak
// (`/portal/tagihan/2026-10`) tetap dihitung milik tab induknya, dan alamat
// portal yang belum punya tab sendiri cukup menyalakan tab akarnya. Karena
// `/portal` adalah awalan dari semua alamat portal, urutannya diselesaikan
// dengan kecocokan terpanjang — tanpa itu tab Beranda akan selalu menyala.
export function tabAktifDari(
  hrefs: readonly string[],
  pathname: string,
): string | undefined {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}
