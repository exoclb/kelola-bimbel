import test from "node:test";
import assert from "node:assert/strict";
import {
  aturPreferensi,
  bersihkan,
  buatGuru,
  buatPemilik,
  jumlahNotifikasi,
  pool,
} from "./harness/notifikasi.mjs";

const { JENIS_NOTIFIKASI, DAFTAR_JENIS_NOTIFIKASI } =
  await import("../src/lib/notifikasi.ts");
const { buatNotifikasi, penerimaNotifikasi } =
  await import("../src/services/notifikasi.service.ts");
const { ubahPreferensiNotifikasiSchema } =
  await import("../src/validators/pengaturan.ts");

// Verifikasi idempotensi & preferensi notifikasi untuk SELURUH katalog jenis,
// bukan satu-satu jenis yang kebetulan punya pemicu: berkas tes lain membuktikan
// perilaku pemicunya masing-masing, berkas ini membuktikan janji umumnya tetap
// berlaku untuk tiap baris `JENIS_NOTIFIKASI` — termasuk jenis yang pemicunya
// belum ada (`kelas_kosong`) dan yang bawaannya mati (`laporan_bulanan`).
//
// Yang dijaga di sini adalah kalau katalog bertambah: baris baru otomatis ikut
// diuji idempotensinya, bawaan aktif/matinya, dan diterimanya oleh validator
// preferensi.

/** Kunci peristiwa uji; dipakai ulang untuk membuktikan pengulangan. */
function kunci(jenis, putaran) {
  return `katalog:${jenis}:${putaran}`;
}

test("setiap jenis katalog lengkap dan muat di kolomnya", () => {
  assert.ok(JENIS_NOTIFIKASI.length > 0);

  const jenis = JENIS_NOTIFIKASI.map((item) => item.jenis);
  assert.equal(
    new Set(jenis).size,
    jenis.length,
    "jenis notifikasi tidak boleh kembar",
  );
  assert.deepEqual(jenis, DAFTAR_JENIS_NOTIFIKASI);

  for (const item of JENIS_NOTIFIKASI) {
    // `notifications.tipe` hanya `varchar(40)` dan tanpa spasi di tepinya,
    // jadi nama jenis yang kepanjangan akan gagal saat ditulis.
    assert.match(item.jenis, /^[a-z][a-z0-9_]*$/);
    assert.ok(item.jenis.length <= 40, `${item.jenis} muat di kolom tipe`);

    // Judul dan keterangan tampil di halaman Preferensi Notifikasi, jadi
    // keduanya harus bisa dibaca pemilik bimbel — bukan label teknis kosong.
    assert.ok(item.judul.trim().length >= 3, `${item.jenis} punya judul`);
    assert.ok(
      item.keterangan.trim().length >= 30,
      `${item.jenis} menjelaskan kapan pemberitahuannya muncul`,
    );
    assert.equal(typeof item.bawaanAktif, "boolean");
  }
});

/**
 * Idempotensi berlaku untuk semua jenis: satu kunci peristiwa menghasilkan satu
 * baris untuk akun itu, dan mengirim ulang peristiwa yang sama tidak menambah
 * baris kedua. Diuji untuk seluruh katalog sekaligus, jadi jenis yang baru
 * ditambahkan langsung ikut terjaga.
 */
test("setiap jenis katalog menulis satu baris per kunci peristiwa", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Katalog Idempoten");

  for (const { jenis, bawaanAktif } of JENIS_NOTIFIKASI) {
    // Jenis yang bawaannya mati perlu dinyalakan dulu supaya barisnya memang
    // ingin ditulis; yang lain dibiarkan tanpa baris preferensi.
    if (!bawaanAktif) await aturPreferensi(guru.id, jenis, true);

    const pertama = await buatNotifikasi(
      jenis,
      `Uji katalog ${jenis}.`,
      [guru.id],
      kunci(jenis, 1),
    );
    assert.equal(pertama, 1, `${jenis} menulis satu baris`);

    const ulang = await buatNotifikasi(
      jenis,
      `Uji katalog ${jenis}.`,
      [guru.id],
      kunci(jenis, 1),
    );
    assert.equal(ulang, 0, `${jenis} tidak menulis baris kedua`);
    assert.equal(await jumlahNotifikasi(guru.id, jenis), 1);

    // Peristiwa lain tetap boleh mengabari lagi: yang ditahan indeks unik
    // adalah kuncinya, bukan jenisnya.
    const lain = await buatNotifikasi(
      jenis,
      `Uji katalog ${jenis} lagi.`,
      [guru.id],
      kunci(jenis, 2),
    );
    assert.equal(lain, 1, `${jenis} menerima peristiwa berikutnya`);
  }

  const { rows } = await pool.query(
    "SELECT DISTINCT tipe FROM notifications WHERE user_id = $1",
    [guru.id],
  );
  assert.deepEqual(
    rows.map((baris) => baris.tipe).sort(),
    [...DAFTAR_JENIS_NOTIFIKASI].sort(),
    "setiap jenis di katalog tersimpan dengan namanya sendiri",
  );

  await bersihkan();
});

/**
 * Bawaan katalog dihormati oleh `penerimaNotifikasi`: akun yang belum pernah
 * mengubah pengaturannya menerima jenis yang bawaannya aktif, dan tidak
 * menerima jenis yang bawaannya mati sampai ia menyalakannya sendiri.
 */
test("bawaan aktif tiap jenis dipakai sebelum akun mengubah pengaturannya", async () => {
  await bersihkan();
  const guru = await buatGuru("Guru Katalog Bawaan");
  const pemilik = await buatPemilik("Pemilik Katalog Bawaan");

  for (const { jenis, bawaanAktif } of JENIS_NOTIFIKASI) {
    assert.deepEqual(
      await penerimaNotifikasi(jenis, [guru.id]),
      bawaanAktif ? [guru.id] : [],
      `${jenis} bawaannya ${bawaanAktif ? "aktif" : "mati"}`,
    );

    const ditulis = await buatNotifikasi(
      jenis,
      `Bawaan ${jenis}.`,
      [guru.id],
      kunci(jenis, "bawaan"),
    );
    assert.equal(
      ditulis,
      bawaanAktif ? 1 : 0,
      `baris ${jenis} mengikuti bawaan`,
    );

    // Keadaannya dibalik dari bawaannya: yang menerima berubah, dan yang
    // ditahan tidak menyisakan baris apa pun.
    await aturPreferensi(guru.id, jenis, !bawaanAktif);
    assert.deepEqual(
      await penerimaNotifikasi(jenis, [guru.id]),
      bawaanAktif ? [] : [guru.id],
    );

    const setelahDiubah = await buatNotifikasi(
      jenis,
      `Setelah diubah ${jenis}.`,
      [guru.id],
      kunci(jenis, "setelah-diubah"),
    );
    assert.equal(
      setelahDiubah,
      bawaanAktif ? 0 : 1,
      `pilihan akun mengalahkan bawaan ${jenis}`,
    );
  }

  // Jenis yang bawaannya mati tetap bisa dinyalakan oleh pemiliknya: itu yang
  // membedakannya dari jenis yang tidak pernah dikirim.
  const mati = JENIS_NOTIFIKASI.filter((item) => !item.bawaanAktif);
  for (const item of mati) {
    await aturPreferensi(pemilik.id, item.jenis, true);
    assert.deepEqual(await penerimaNotifikasi(item.jenis, [pemilik.id]), [
      pemilik.id,
    ]);
  }

  await bersihkan();
});

/**
 * Preferensi hanya menahan jenisnya sendiri: akun yang mematikan satu jenis
 * tetap menerima jenis lain pada peristiwa yang sama, dan akun yang
 * mematikannya tidak ikut menahan akun lain.
 */
test("preferensi satu jenis tidak menahan jenis atau akun lain", async () => {
  await bersihkan();
  const mematikan = await buatGuru("Guru Katalog Mematikan");
  const memakai = await buatGuru("Guru Katalog Memakai");

  for (const { jenis } of JENIS_NOTIFIKASI) {
    await aturPreferensi(mematikan.id, jenis, false);
    await aturPreferensi(memakai.id, jenis, true);

    const dibuat = await buatNotifikasi(
      jenis,
      `Silang preferensi ${jenis}.`,
      [mematikan.id, memakai.id],
      kunci(jenis, "silang"),
    );
    assert.equal(dibuat, 1, `${jenis} hanya sampai ke akun yang menyetujuinya`);

    assert.equal(await jumlahNotifikasi(mematikan.id, jenis), 0);
    assert.equal(await jumlahNotifikasi(memakai.id, jenis), 1);
  }

  await bersihkan();
});

/**
 * Validator preferensi (dipakai endpoint ubah preferensi) menerima setiap jenis
 * di katalog dan menolak yang bukan, karena jenis yang tidak dikenal akan
 * tersimpan sebagai baris yang tidak berpengaruh apa-apa.
 */
test("validator preferensi menerima seluruh katalog dan menolak lainnya", () => {
  for (const { jenis } of JENIS_NOTIFIKASI) {
    assert.equal(
      ubahPreferensiNotifikasiSchema.parse({ jenis, aktif: false }).jenis,
      jenis,
    );
  }

  const jenisAsing = ubahPreferensiNotifikasiSchema.safeParse({
    jenis: "jenis_yang_tidak_ada",
    aktif: true,
  });
  assert.equal(jenisAsing.success, false);
  assert.equal(jenisAsing.error.issues[0].code, "invalid_value");

  const kosong = ubahPreferensiNotifikasiSchema.safeParse({
    jenis: JENIS_NOTIFIKASI[0].jenis,
    aktif: "ya",
  });
  assert.equal(kosong.success, false);
  assert.equal(kosong.error.issues[0].code, "invalid_type");

  const berlebih = ubahPreferensiNotifikasiSchema.safeParse({
    jenis: JENIS_NOTIFIKASI[0].jenis,
    aktif: true,
    alasan: "tidak dikenal",
  });
  assert.equal(berlebih.success, false);
  assert.equal(berlebih.error.issues[0].code, "unrecognized_keys");
});
