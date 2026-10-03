// Postgres menandai pelanggaran indeks unik dengan kode 23505, dan Drizzle
// membungkus error aslinya, jadi kodenya dicari sampai ke `cause`.
export function kodeError(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  if ("code" in error) return error.code;
  if ("cause" in error) return kodeError(error.cause);
  return undefined;
}

/** Benar kalau errornya berasal dari indeks unik (mis. baris yang sudah ada). */
export function pelanggaranUnik(error: unknown) {
  return kodeError(error) === "23505";
}
