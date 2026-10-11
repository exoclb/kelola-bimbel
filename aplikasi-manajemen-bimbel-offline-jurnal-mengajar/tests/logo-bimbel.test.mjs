import test from "node:test";
import assert from "node:assert/strict";
import { pasangAliasSrc } from "./harness/alias.mjs";

// Modul aplikasi diimpor setelah alias tsconfig-nya terpasang; impor statis
// di-resolve sebelum hook-nya sempat dipasang.
pasangAliasSrc();
const { MAX_LOGO_BYTE, bacaIsiLogo, isiLogoGambar, ukuranLogo } =
  await import("../src/lib/logo.ts");
const { PESAN_LOGO_BUKAN_GAMBAR, PESAN_UKURAN_LOGO } =
  await import("../src/lib/logo.ts");
const { profilBimbelSchema, unggahLogoSchema } =
  await import("../src/validators/pengaturan.ts");

// Logo bimbel disimpan sebagai data URL di kolom teks, jadi yang menjaganya
// bukan tipe kolom melainkan pemeriksaan isi di `src/lib/logo.ts`: data URL
// yang mengaku PNG padahal isinya teks akan lolos basis data
// (`bimbel_profile` hanya menuntut awalan `data:image/`) tetapi muncul sebagai
// gambar rusak di kop slip gaji dan lembar laporan. Berkas ini mengunci dua
// hal yang tidak bisa dilihat dari bentuk teksnya: tipe yang benar-benar
// terbaca dari byte awal berkas, dan ukuran byte hasil dekodenya. Batas
// ukurannya sama persis dengan yang dipakai peramban saat memilih berkas
// (`MAX_LOGO_BYTE`), sehingga jalur unggah mana pun menolak berkas yang sama —
// dan berbeda dari batas panjang teks data URL-nya, yang cuma penyaring murah
// sebelum mendekode (1.400.000 karakter ≈ 1,05 MB byte).

const bytePng = Buffer.from("89504e470d0a1a0a", "hex");
const byteJpeg = Buffer.from("ffd8ffe000104a464946000101", "hex");
const byteWebp = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from("1a000000", "hex"),
  Buffer.from("WEBPVP8L", "ascii"),
]);
const byteTeks = Buffer.from("ini bukan gambar, cuma teks biasa", "utf8");

/** Data URL seperti yang dihasilkan `FileReader` peramban. */
function dataUrl(tipe, byte) {
  return `data:${tipe};base64,${byte.toString("base64")}`;
}

/** Isi yang mengaku bertipe gambar, dengan panjang byte yang diminta. */
function byteSeukuran(ukuran) {
  return Buffer.concat([bytePng, Buffer.alloc(ukuran - bytePng.length)]);
}

test("tipe logo dibaca dari byte berkasnya, bukan dari yang diakuinya", () => {
  for (const [tipe, byte] of [
    ["image/png", bytePng],
    ["image/jpeg", byteJpeg],
    ["image/webp", byteWebp],
  ]) {
    const logo = dataUrl(tipe, byte);
    assert.equal(isiLogoGambar(logo), true, `${tipe} seharusnya diterima`);
    assert.deepEqual(bacaIsiLogo(logo), {
      tipe,
      tipeDiakui: tipe,
      ukuranByte: byte.length,
    });
  }

  // Teks yang dikemas sebagai gambar: bentuk data URL-nya benar dan tipenya
  // diakui PNG, tetapi byte awalnya bukan tanda gambar mana pun.
  for (const tipe of ["image/png", "image/jpeg", "image/webp"])
    assert.equal(
      isiLogoGambar(dataUrl(tipe, byteTeks)),
      false,
      `teks yang mengaku ${tipe} seharusnya ditolak`,
    );

  // Berkas PNG yang dikirim dengan tipe yang salah juga ditolak: kop merender
  // gambarnya dari tipe yang diakui peramban.
  const tertukar = dataUrl("image/jpeg", bytePng);
  assert.equal(isiLogoGambar(tertukar), false);
  assert.deepEqual(bacaIsiLogo(tertukar), {
    tipe: "image/png",
    tipeDiakui: "image/jpeg",
    ukuranByte: bytePng.length,
  });
});

test("data URL yang tidak bisa dibaca tidak dianggap gambar", () => {
  const tidakTerbaca = [
    "https://contoh.test/logo.png",
    "",
    "data:image/svg+xml;base64,PHN2Zy8+",
    "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    // Tanpa isi sama sekali.
    "data:image/png;base64,",
    // Panjangnya tidak mungkin base64 (sisa 1 karakter setelah dibulatkan).
    "data:image/png;base64,AAAAA",
    // Ada spasi, bukan base64 yang bisa didekode.
    "data:image/png;base64,AAAA AAA=",
  ];

  for (const logo of tidakTerbaca) {
    assert.equal(bacaIsiLogo(logo), null, `${logo} seharusnya tak terbaca`);
    assert.equal(isiLogoGambar(logo), false);
    assert.equal(ukuranLogo(logo), null);
  }

  // Data URL yang sah tetapi isinya cuma satu byte tetap "terbaca" —
  // ukurannya dihitung dari byte itu, bukan dari bentuk teksnya.
  assert.equal(ukuranLogo("data:image/png;base64,AA=="), 1);
  assert.equal(isiLogoGambar("data:image/png;base64,AA=="), false);
});

test("ukuran logo dihitung dari byte hasil dekode, bukan panjang teksnya", () => {
  const tepat = byteSeukuran(MAX_LOGO_BYTE);
  const lebih = byteSeukuran(MAX_LOGO_BYTE + 1);
  assert.equal(ukuranLogo(dataUrl("image/png", tepat)), MAX_LOGO_BYTE);
  assert.equal(ukuranLogo(dataUrl("image/png", lebih)), MAX_LOGO_BYTE + 1);

  // Panjang teksnya masih di bawah batas karakter (1.400.000), jadi yang
  // menolaknya memang pemeriksaan byte — bukan penyaring panjang teks.
  const logoLebih = dataUrl("image/png", lebih);
  assert.ok(logoLebih.length < 1_400_000);

  // Berkas 1 MB berisi gambar sungguhan masih diterima lewat kedua jalur isian.
  const isian = { nama: "Bimbel Uji", logo: dataUrl("image/png", tepat) };
  assert.deepEqual(profilBimbelSchema.parse(isian), {
    nama: "Bimbel Uji",
    alamat: "",
    telepon: "",
    email: "",
    logo: isian.logo,
  });
  assert.equal(unggahLogoSchema.parse({ logo: isian.logo }).logo, isian.logo);
});

test("isian profil menolak logo yang bukan gambar atau kebesaran", () => {
  const isian = (logo) => ({ nama: "Bimbel Uji", logo });
  const pesanLogo = (skema, nilai) => {
    const hasil = skema.safeParse(nilai);
    assert.equal(hasil.success, false, `${nilai} seharusnya ditolak`);
    return hasil.error.issues
      .filter((item) => item.path.join(".") === "logo")
      .map((item) => item.message);
  };
  const pesanDataUrl = "Logo harus berupa data URL gambar PNG, JPG, atau WebP.";

  // Teks yang mengaku PNG: ditolak karena isinya, bukan karena bentuknya.
  assert.deepEqual(
    pesanLogo(profilBimbelSchema, isian(dataUrl("image/png", byteTeks))),
    [PESAN_LOGO_BUKAN_GAMBAR],
  );
  // Tipe yang tidak didukung sudah ditolak bentuk data URL-nya, dan isinya juga
  // bukan gambar — dua alasan, satu kolom.
  assert.deepEqual(
    pesanLogo(profilBimbelSchema, isian(dataUrl("image/gif", byteTeks))).sort(),
    [pesanDataUrl, PESAN_LOGO_BUKAN_GAMBAR].sort(),
  );
  // Satu byte di atas batas sudah ditolak, dengan pesan ukuran — bukan pesan
  // "bukan gambar", karena gambarnya sendiri sah.
  assert.deepEqual(
    pesanLogo(
      profilBimbelSchema,
      isian(dataUrl("image/png", byteSeukuran(MAX_LOGO_BYTE + 1))),
    ),
    [PESAN_UKURAN_LOGO],
  );
  // Data URL yang panjang teksnya melewati penyaring murah juga menyebut ukuran.
  assert.ok(
    pesanLogo(
      profilBimbelSchema,
      isian(`data:image/png;base64,${"A".repeat(1_400_001)}`),
    ).includes(PESAN_UKURAN_LOGO),
  );

  // Logo yang dihapus (`null`) dan yang tidak dikirim sama-sama sah.
  assert.equal(
    profilBimbelSchema.parse({ nama: "Bimbel Uji", logo: null }).logo,
    null,
  );
  assert.equal(
    profilBimbelSchema.parse({ nama: "Bimbel Uji" }).logo,
    undefined,
  );
});

test("unggah logo menuntut satu kolom saja dan menolak yang lain", () => {
  const logo = dataUrl("image/png", bytePng);
  assert.deepEqual(unggahLogoSchema.parse({ logo }), { logo });

  const tolak = (nilai, alasan) => {
    const hasil = unggahLogoSchema.safeParse(nilai);
    assert.equal(hasil.success, false, alasan);
  };
  tolak({}, "logo wajib ada");
  tolak({ logo: null }, "unggah tidak boleh menghapus lewat null");
  tolak({ logo: "bukan data url" }, "bukan data URL");
  tolak({ logo, nama: "Bimbel Uji" }, "unggah bukan jalur ganti profil");
  tolak({ logo, logoLama: logo }, "kolom asing");
});
