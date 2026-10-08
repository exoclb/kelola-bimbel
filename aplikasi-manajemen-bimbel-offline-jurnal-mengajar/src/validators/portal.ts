import { z } from "zod";

/**
 * Halaman/endpoint portal wali selalu membawa id anak di `?anak=`; anak yang
 * tidak tertaut ke akun wali yang sedang masuk dijawab 404 oleh endpointnya.
 */
export const anakPortalSchema = z
  .object({ anak: z.string().uuid("Id anak harus UUID yang sah.") })
  .strict();

export type AnakPortalInput = z.infer<typeof anakPortalSchema>;
