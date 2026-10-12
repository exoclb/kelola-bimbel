import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { siteConfig } from "@/config/site";
import { env } from "@/lib/env";
import { ac, ADMIN_ROLES, DEFAULT_ROLE, roles } from "@/lib/permissions";
import { kirimEmailTautanReset } from "@/services/email.service";

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  advanced: { cookiePrefix: `ngodingpakeai-${siteConfig.id}` },
  // Uji e2e menjalankan server produksi lokal di atas basis data sekali pakai.
  // Batas laju auth dimatikan di sana supaya berkas uji tidak saling
  // menghabiskan kuota; produksi tetap memakai batas bawaan Better Auth.
  rateLimit: process.env.STARTER_TEST_RUN ? { enabled: false } : undefined,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Add an email provider before enabling verification. Password recovery
    // already works: see sendResetPassword below.
    requireEmailVerification: false,
    // Sandi baru berarti sesi lama tidak boleh dipakai lagi — penting kalau
    // sandinya diganti justru karena akunnya sempat dipakai orang lain.
    revokeSessionsOnPasswordReset: true,
    // Tautan atur ulang sandi dikirim lewat SMTP yang diatur variabel lingkungan
    // (src/lib/smtp.ts + src/services/email.service.ts). Kalau SMTP belum diatur
    // atau pengirimannya gagal, fungsi ini tetap selesai tanpa galat supaya
    // permintaan lupa sandi tidak membocorkan email mana yang punya akun; yang
    // gagal hanya dicatat tanpa tautannya — kalau tidak, tautan berisi token
    // akan menumpuk di log produksi.
    sendResetPassword: async ({ user, url }) => {
      const hasil = await kirimEmailTautanReset({
        ke: user.email,
        nama: user.name,
        tautan: url,
      });
      if (!hasil.terkirim)
        console.warn(
          `[lupa-sandi] email tautan atur ulang untuk ${user.email} tidak terkirim: ${hasil.alasan}`,
        );
    },
  },
  plugins: [
    // Roles come from the access control in lib/permissions.ts. New accounts get
    // DEFAULT_ROLE; `role` is not accepted from signup input, so nobody can
    // grant themselves one. Use npm run role:set to promote an account.
    admin({
      ac,
      roles,
      defaultRole: DEFAULT_ROLE,
      adminRoles: ADMIN_ROLES,
    }),
    // Keep nextCookies() last so it observes every other plugin's cookies.
    nextCookies(),
  ],
});
