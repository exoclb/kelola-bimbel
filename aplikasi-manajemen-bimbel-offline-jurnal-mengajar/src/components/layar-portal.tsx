/**
 * Kerangka satu layar Portal Wali: label kecil "Portal Wali", judul halaman,
 * keterangan singkat, baris status untuk pembaca layar, lalu isi layarnya.
 *
 * Semua layar portal memakai ini supaya jarak, ukuran judul, dan cara
 * mengumumkan perubahan isinya sama. Lebar kolomnya sudah diatur cangkang
 * portal (`--lebar-konten-portal`), jadi komponen ini tidak membatasi lebar
 * lagi. Isinya presentasional (tanpa "use client") sehingga boleh dipakai dari
 * komponen server maupun klien.
 */
export function LayarPortal({
  judul,
  keterangan,
  pesanStatus,
  atas,
  children,
}: {
  judul: string;
  keterangan: string;
  /**
   * Pesan keadaan untuk pembaca layar, mis. "Bagian tagihan sudah ditandai
   * dibaca.". Diumumkan lewat `role="status"`; biarkan kosong bila tidak ada.
   */
  pesanStatus?: string;
  /** Isi opsional di atas judul, mis. kop identitas bimbel di Beranda. */
  atas?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <>
      {atas && <div className="mb-6">{atas}</div>}
      <p className="text-primary mb-3 text-sm font-medium">Portal Wali</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {judul}
      </h1>
      <p className="text-muted-foreground mt-3 text-base">{keterangan}</p>
      <p role="status" className="text-muted-foreground mt-3 text-sm empty:mt-0">
        {pesanStatus}
      </p>
      {children}
    </>
  );
}
