import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Every resource an action can target. `defaultStatements` covers Better Auth's
// own user and session management; add a key per resource your app owns.
// Name actions for what they let someone do to *other people's* rows: owners
// already reach their own data through the session, so a role only has to grant
// the extra reach. Add a resource here first, then give roles a subset below.
export const statement = {
  ...defaultStatements,
  notes: ["read-any", "delete-any"],
  // Guru hanya melihat jurnalnya sendiri lewat sesi; aksi ini memberi owner
  // (dan admin) kemampuan membaca jurnal guru lain.
  jurnal: ["read-any"],
  // Rekap gaji seluruh guru hanya untuk owner.
  gaji: ["read-any"],
  // Catatan perkembangan dan kehadiran anak. Berbeda dari jurnal, datanya
  // memang dipakai bersama guru pengampu, jadi aksinya menggambarkan siapa
  // yang boleh membuka fitur ini sama sekali: guru (role `user`), owner, dan
  // admin. Peran lain tidak diberi izin ini.
  perkembangan: ["read", "write"],
  // Pengaturan bimbel (profil, aturan gaji, kelola guru) hanya untuk owner:
  // guru tidak mengubah data yang memengaruhi seluruh bimbel.
  pengaturan: ["read", "write"],
} as const;

export const ac = createAccessControl(statement);

// A role is a subset of the statement. `user` is deliberately minimal: apart
// from the shared development records (every guru needs to read and write
// them), the signed-in default can do nothing beyond its own rows.
export const roles = {
  user: ac.newRole({ notes: [], perkembangan: ["read", "write"] }),
  // Pemilik bimbel: memantau jurnal dan gaji semua guru, tanpa hak admin sistem.
  owner: ac.newRole({
    jurnal: ["read-any"],
    gaji: ["read-any"],
    perkembangan: ["read", "write"],
    pengaturan: ["read", "write"],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    notes: ["read-any", "delete-any"],
    jurnal: ["read-any"],
    gaji: ["read-any"],
    perkembangan: ["read", "write"],
    pengaturan: ["read", "write"],
  }),
} as const;

export type AppRole = keyof typeof roles;

// Roles live in the `user.role` column as a string. Better Auth reads a
// comma-separated list, so "admin,support" grants the union of both.
export const DEFAULT_ROLE = "user" satisfies AppRole;
export const ADMIN_ROLES = ["admin"] satisfies AppRole[];

// The shape accepted by permission checks, e.g. { notes: ["read-any"] }.
export type Permissions = Partial<{
  [Resource in keyof typeof statement]: (typeof statement)[Resource][number][];
}>;
