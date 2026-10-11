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
  // Portal orang tua: membaca tagihan dan perkembangan anak yang tertaut ke
  // akun wali. Penautan anak dibatasi lewat sesi, bukan lewat izin ini.
  portal: ["read"],
  // Pengeluaran operasional bimbel. Hanya owner yang mencatat dan mengelola.
  pengeluaran: ["read-any", "write-any"],
  // Tagihan bulanan murid. Owner membuat tagihan dan menandainya lunas untuk
  // semua murid; murid/wali melihat tagihannya sendiri lewat sesi, tanpa izin
  // tambahan.
  tagihan: ["read-any", "write-any"],
  // Catatan perkembangan dan kehadiran anak. Berbeda dari jurnal, datanya
  // memang dipakai bersama guru pengampu, jadi aksinya menggambarkan siapa
  // yang boleh membuka fitur ini sama sekali: guru (role `user`), owner, dan
  // admin. Peran lain tidak diberi izin ini.
  perkembangan: ["read", "write"],
  // Data bimbel yang dipakai bersama staf — murid, kelas, jadwal, penempatan,
  // jurnal, presensi guru, dan rekap gaji. Aksi ini yang memisahkan akun staf
  // (guru, owner, admin) dari akun wali (`orang-tua`): wali hanya membuka
  // portal anaknya, jadi perannya sengaja tidak diberi `staf`. Endpoint yang
  // menyentuh data bersama wajib memakainya — sesi yang sah saja tidak cukup,
  // karena akun wali juga punya sesi.
  staf: ["read", "write"],
  // Pengaturan bimbel (profil, aturan gaji, kelola guru) hanya untuk owner:
  // guru tidak mengubah data yang memengaruhi seluruh bimbel.
  pengaturan: ["read", "write"],
} as const;

export const ac = createAccessControl(statement);

// A role is a subset of the statement. `user` is deliberately minimal: apart
// from the shared development records (every guru needs to read and write
// them), the signed-in default can do nothing beyond its own rows.
export const roles = {
  // Guru: mengelola data bimbel yang dipakai bersama sesama staf (murid,
  // kelas, jurnal, presensi) dan menulis catatan perkembangannya sendiri.
  user: ac.newRole({
    staf: ["read", "write"],
    notes: [],
    perkembangan: ["read", "write"],
  }),
  // Orang tua/wali: hanya membuka portal dan membaca data anaknya. Sengaja
  // tanpa `staf`, jadi rute tulis maupun baca data bimbel menjawab 403.
  "orang-tua": ac.newRole({ portal: ["read"] }),
  // Pemilik bimbel: memantau jurnal dan gaji semua guru, tanpa hak admin sistem.
  owner: ac.newRole({
    staf: ["read", "write"],
    jurnal: ["read-any"],
    gaji: ["read-any"],
    tagihan: ["read-any", "write-any"],
    pengeluaran: ["read-any", "write-any"],
    portal: ["read"],
    perkembangan: ["read", "write"],
    pengaturan: ["read", "write"],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    staf: ["read", "write"],
    notes: ["read-any", "delete-any"],
    jurnal: ["read-any"],
    gaji: ["read-any"],
    tagihan: ["read-any", "write-any"],
    pengeluaran: ["read-any", "write-any"],
    portal: ["read"],
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
