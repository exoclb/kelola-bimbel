// Pembantu untuk komponen klien yang memanggil API aplikasi: mengambil pesan
// galat dari bentuk jawaban seragam (`{ error: { message } }`) supaya pesan
// bahasa Indonesia dari server yang tampil, bukan teks bawaan peramban.

/** Pesan galat dari jawaban API; `cadangan` dipakai untuk galat jaringan. */
export async function pesanGalatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return isi?.error?.message ?? cadangan;
}
