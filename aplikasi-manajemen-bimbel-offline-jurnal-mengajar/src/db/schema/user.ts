import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // Better Auth admin plugin. `role` holds one name, or several separated by
    // commas ("admin,support"). Signup cannot set it; see src/lib/permissions.ts
    // for the roles. Defaultnya sama dengan `DEFAULT_ROLE` di berkas itu: guru.
    // Kolomnya sengaja text, bukan enum, karena Better Auth merangkai beberapa
    // peran sekaligus di kolom yang sama.
    role: text("role").default("user").notNull(),
    // Dipakai sebagai penanda akun aktif: akun yang di-ban tidak bisa masuk,
    // jadi tidak perlu kolom "status_aktif" terpisah.
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  // Daftar guru dan owner disaring per peran (mis. "kelola guru" milik owner).
  (table) => [index("user_role_idx").on(table.role)],
);
