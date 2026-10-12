import test from "node:test";
import assert from "node:assert/strict";
import {
  PORT_SMTP_BAWAAN,
  PORT_SMTP_TLS_LANGSUNG,
  VARIABEL_SMTP,
  bacaKonfigurasiSmtp,
  smtpSiap,
} from "../src/lib/smtp.ts";

// `bacaKonfigurasiSmtp` menentukan apakah tautan atur ulang sandi dikirim lewat
// SMTP atau dicatat ke log server (Fase 1). Uji di sini menjaga dua hal: isian
// lengkap benar-benar dianggap siap, dan isian yang salah tidak pernah membuat
// modul melempar galat — aplikasi harus tetap jalan tanpa penyedia email.

const ISIAN_LENGKAP = {
  [VARIABEL_SMTP.host]: "smtp.contoh.id",
  [VARIABEL_SMTP.port]: "587",
  [VARIABEL_SMTP.pengguna]: "bimbel@contoh.id",
  [VARIABEL_SMTP.sandi]: "sandi-rahasia",
  [VARIABEL_SMTP.pengirim]: "bimbel@contoh.id",
};

test("SMTP yang belum diatur bukan galat, cukup jatuh ke log server", () => {
  const status = bacaKonfigurasiSmtp({});
  assert.equal(status.siap, false);
  assert.equal(status.konfigurasi, null);
  assert.deepEqual(status.variabelBermasalah, [VARIABEL_SMTP.host]);
  assert.match(status.keterangan, /log server/);
  assert.equal(smtpSiap({}), false);
});

test("isian lengkap menghasilkan konfigurasi siap dipakai", () => {
  const status = bacaKonfigurasiSmtp(ISIAN_LENGKAP);
  assert.equal(status.siap, true);
  assert.equal(smtpSiap(ISIAN_LENGKAP), true);
  assert.equal(status.konfigurasi?.host, "smtp.contoh.id");
  assert.equal(status.konfigurasi?.port, 587);
  assert.equal(status.konfigurasi?.pengguna, "bimbel@contoh.id");
  assert.equal(status.konfigurasi?.sandi, "sandi-rahasia");
  assert.deepEqual(status.konfigurasi?.pengirim, { alamat: "bimbel@contoh.id" });
});

test("port bawaan 587 dan mode TLS mengikuti port", () => {
  const tanpaPort = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.port]: "",
  });
  assert.equal(tanpaPort.konfigurasi?.port, PORT_SMTP_BAWAAN);
  assert.equal(tanpaPort.konfigurasi?.aman, false);

  const port465 = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.port]: String(PORT_SMTP_TLS_LANGSUNG),
  });
  assert.equal(port465.konfigurasi?.port, PORT_SMTP_TLS_LANGSUNG);
  assert.equal(port465.konfigurasi?.aman, true);
});

test("SMTP_SECURE menimpa nilai yang diturunkan dari port", () => {
  const paksaAman = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.secure]: "true",
  });
  assert.equal(paksaAman.konfigurasi?.aman, true);

  const paksaBiasa = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.port]: "465",
    [VARIABEL_SMTP.secure]: "false",
  });
  assert.equal(paksaBiasa.konfigurasi?.aman, false);

  const tidakJelas = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.secure]: "kadang-kadang",
  });
  assert.equal(tidakJelas.siap, false);
  assert.ok(
    tidakJelas.variabelBermasalah.includes(VARIABEL_SMTP.secure),
    "variabel SMTP_SECURE yang salah harus dilaporkan",
  );
});

test("alamat pengirim memakai SMTP_USER kalau SMTP_FROM kosong", () => {
  const status = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.pengirim]: "",
  });
  assert.equal(status.konfigurasi?.pengirim.alamat, "bimbel@contoh.id");

  const tanpaNama = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.namaPengirim]: "",
  });
  assert.equal(tanpaNama.konfigurasi?.pengirim.nama, undefined);

  const denganNama = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.namaPengirim]: "Bimbel Contoh",
  });
  assert.equal(denganNama.konfigurasi?.pengirim.nama, "Bimbel Contoh");
});

test("server SMTP tanpa autentikasi tetap sah selama pengirimnya jelas", () => {
  const status = bacaKonfigurasiSmtp({
    [VARIABEL_SMTP.host]: "smtp.contoh.id",
    [VARIABEL_SMTP.pengirim]: "bimbel@contoh.id",
  });
  assert.equal(status.siap, true);
  assert.equal(status.konfigurasi?.pengguna, undefined);
  assert.equal(status.konfigurasi?.sandi, undefined);
});

test("isian yang setengah atau salah dilaporkan tanpa melempar galat", () => {
  const akunSetengah = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.pengirim]: "",
    [VARIABEL_SMTP.sandi]: "",
  });
  assert.equal(akunSetengah.siap, false);
  assert.ok(akunSetengah.variabelBermasalah.includes(VARIABEL_SMTP.sandi));

  const portSalah = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.port]: "tujuh ribu",
  });
  assert.equal(portSalah.siap, false);
  assert.ok(
    portSalah.variabelBermasalah.includes(VARIABEL_SMTP.port),
    "port yang bukan angka harus dilaporkan",
  );

  const portDiLuarJangkauan = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.port]: "70000",
  });
  assert.equal(portDiLuarJangkauan.siap, false);

  const pengirimSalah = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.pengirim]: "bukan-email",
  });
  assert.equal(pengirimSalah.siap, false);
  assert.ok(
    pengirimSalah.variabelBermasalah.includes(VARIABEL_SMTP.pengirim),
  );
});

test("nilai dibersihkan dari spasi dan sandi tidak bocor ke keterangan", () => {
  const status = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.host]: "  smtp.contoh.id  ",
    [VARIABEL_SMTP.sandi]: "sandi-rahasia",
  });
  assert.equal(status.konfigurasi?.host, "smtp.contoh.id");
  assert.doesNotMatch(status.keterangan, /sandi-rahasia/);

  const gagal = bacaKonfigurasiSmtp({
    ...ISIAN_LENGKAP,
    [VARIABEL_SMTP.port]: "bukan-angka",
    [VARIABEL_SMTP.sandi]: "sandi-rahasia",
  });
  assert.doesNotMatch(gagal.keterangan, /sandi-rahasia/);
});
