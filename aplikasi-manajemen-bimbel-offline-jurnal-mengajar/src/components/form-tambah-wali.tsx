"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IsianPilih, IsianTeks } from "@/components/isian-form";
import type { AkunWali } from "@/services/wali.service";

type Galat = {
  nama?: string;
  email?: string;
  sandi?: string;
  aksesPortal?: string;
};

/** Isian yang punya tempat pesan galatnya sendiri di formulir ini. */
const ISIAN_DIKENAL = ["nama", "email", "sandi", "aksesPortal"] as const;

type FormTambahWaliProps = {
  /**
   * Akun wali yang sedang tampil di halaman. Dipakai untuk menolak email yang
   * sudah terdaftar sebelum dikirim, supaya owner tahu lebih dulu tanpa
   * menunggu jawaban server (API tetap memeriksanya sendiri).
   */
  daftar: AkunWali[];
};

/** Panjang sandi mengikuti `tambahWaliSchema` di validator API. */
const PANJANG_SANDI_MIN = 8;
const PANJANG_SANDI_MAKS = 128;

/**
 * Baca galat dari jawaban `/api/wali`. Validator API mengirim pemeriksaan
 * per-isian di `error.details` (mis. nama kurang panjang), jadi pesan itu
 * dipakai lebih dulu supaya kesalahannya menempel di isian yang salah — bukan
 * sebagai pesan umum. `cadangan` untuk jawaban yang tidak berbentuk galat API.
 */
async function galatApi(jawaban: Response, cadangan: string) {
  const isi = (await jawaban.json().catch(() => null)) as {
    error?: {
      message?: string;
      details?: { field?: string; message?: string }[];
    };
  } | null;
  const rincian = (isi?.error?.details ?? []).flatMap((bagian) =>
    bagian.field && bagian.message
      ? [{ field: bagian.field, message: bagian.message }]
      : [],
  );
  return {
    pesan: rincian[0]?.message ?? isi?.error?.message ?? cadangan,
    rincian,
  };
}

/** Data akun yang baru dibuat, untuk kartu konfirmasi sesudah tersimpan. */
type WaliTersimpan = {
  nama: string;
  email: string;
  aksesPortal: boolean;
};

/**
 * Formulir tambah akun wali: nama, email, sandi awal, dan status akses
 * portalnya sejak awal. Isinya dikirim ke `POST /api/wali` (izin
 * `pengaturan: write`), lalu daftar di server disegarkan supaya akun barunya
 * langsung tampil di daftar dan bisa ditautkan ke murid lewat formulir
 * penautan di sebelahnya.
 *
 * Sandi awal hanya dikirim, tidak pernah ditampilkan kembali: kartu konfirmasi
 * menyebut namanya saja, dan pengguna yang lupa bisa memakai alur lupa sandi.
 */
export function FormTambahWali({ daftar }: FormTambahWaliProps) {
  const idForm = useId();
  const router = useRouter();

  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [sandi, setSandi] = useState("");
  const [aksesPortal, setAksesPortal] = useState(true);
  const [galat, setGalat] = useState<Galat>({});
  const [galatUmum, setGalatUmum] = useState("");
  const [pending, setPending] = useState(false);
  const [tersimpan, setTersimpan] = useState<WaliTersimpan | null>(null);

  /** Email yang sudah dipakai akun lain, dibandingkan tanpa peduli besar-kecil. */
  function emailDipakai(emailBaru: string) {
    const rapi = emailBaru.trim().toLocaleLowerCase("id");
    return daftar.some(
      (baris) => baris.email.trim().toLocaleLowerCase("id") === rapi,
    );
  }

  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const namaRapi = nama.trim();
    const emailRapi = email.trim();
    const masalah: Galat = {};
    if (namaRapi.length < 2) {
      masalah.nama = "Nama wali wajib diisi, minimal 2 huruf.";
    } else if (namaRapi.length > 120) {
      masalah.nama = "Nama wali maksimal 120 karakter.";
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRapi)) {
      masalah.email = "Email belum berbentuk alamat email yang benar.";
    } else if (emailDipakai(emailRapi)) {
      masalah.email = `Email ${emailRapi} sudah dipakai akun lain.`;
    }
    if (sandi.length < PANJANG_SANDI_MIN) {
      masalah.sandi = `Sandi minimal ${PANJANG_SANDI_MIN} huruf.`;
    } else if (sandi.length > PANJANG_SANDI_MAKS) {
      masalah.sandi = `Sandi maksimal ${PANJANG_SANDI_MAKS} huruf.`;
    }

    if (Object.keys(masalah).length > 0) {
      setGalat(masalah);
      return;
    }

    setPending(true);
    setGalatUmum("");
    try {
      const jawaban = await fetch("/api/wali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: namaRapi,
          email: emailRapi,
          sandi,
          aksesPortal,
        }),
      });

      if (!jawaban.ok) {
        const { pesan, rincian } = await galatApi(
          jawaban,
          `Akun wali ${namaRapi} belum bisa dibuat. Coba lagi sebentar lagi.`,
        );
        // Email kembar dijawab 409 supaya pesannya menempel di isian email,
        // bukan sebagai galat umum di bawah formulir.
        if (jawaban.status === 409) {
          setGalat({ email: pesan });
        } else if (rincian.length > 0) {
          const perIsian: Galat = {};
          const sisa: string[] = [];
          for (const bagian of rincian) {
            if ((ISIAN_DIKENAL as readonly string[]).includes(bagian.field)) {
              perIsian[bagian.field as keyof Galat] = bagian.message;
            } else {
              sisa.push(bagian.message);
            }
          }
          setGalat(perIsian);
          setGalatUmum(sisa.join(" "));
        } else {
          setGalatUmum(pesan);
        }
        return;
      }

      // Formulir dikosongkan begitu tersimpan supaya akun wali berikutnya bisa
      // langsung diketik, dan sandi awal tidak lagi disimpan di state setelah
      // terkirim — kartu konfirmasi di bawah hanya menyebut nama dan emailnya.
      setTersimpan({ nama: namaRapi, email: emailRapi, aksesPortal });
      setNama("");
      setEmail("");
      setSandi("");
      setAksesPortal(true);
      setGalat({});
      // Daftar akun di halaman ini datang dari server, jadi daftarnya dibaca
      // ulang supaya akun baru langsung muncul dan bisa ditautkan.
      router.refresh();
    } catch {
      setGalatUmum(
        `Akun wali ${namaRapi} belum bisa dibuat. Coba lagi sebentar lagi.`,
      );
    } finally {
      setPending(false);
    }
  }

  function tambahLagi() {
    setTersimpan(null);
    setGalatUmum("");
  }

  if (tersimpan) {
    return (
      <Card className="border-primary/30" role="status">
        <CardHeader>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>Akun wali dibuat</CardTitle>
          <CardDescription>
            {tersimpan.aksesPortal
              ? "Wali ini sudah bisa masuk ke Portal Wali setelah diberi tahu sandinya."
              : "Akun ini belum bisa masuk sampai akses portalnya dinyalakan."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 rounded-xl bg-muted px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Nama</dt>
              <dd className="font-medium">{tersimpan.nama}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{tersimpan.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Akses portal</dt>
              <dd className="font-medium">
                {tersimpan.aksesPortal ? "Aktif" : "Nonaktif"}
              </dd>
            </div>
          </dl>
          <p className="text-sm leading-6 text-muted-foreground">
            Sandi awal tidak ditampilkan lagi di sini. Sampaikan sandinya ke
            wali, lalu tautkan anaknya lewat formulir di sebelah.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={tambahLagi}
          >
            <UserPlus aria-hidden="true" />
            Tambah wali lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          Tambah akun wali
        </CardTitle>
        <CardDescription>
          Buat akun untuk wali murid: nama, email, sandi awal, dan status akses
          portalnya. Email harus berbeda dari akun yang sudah terdaftar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={simpan} className="space-y-4" noValidate>
          {/*
            Di layar sedang isiannya berpasangan, tetapi di layar lebar kartu
            ini berdiri di kolom sempit (berdampingan dengan formulir
            penautan) sehingga isiannya ditumpuk lagi.
          */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <IsianTeks
              id={`${idForm}-nama`}
              label="Nama wali"
              required
              maxLength={120}
              placeholder="Misalnya: Ibu Ratna"
              value={nama}
              error={galat.nama}
              onChange={(event) => {
                setNama(event.target.value);
                setGalat((sebelumnya) => ({ ...sebelumnya, nama: undefined }));
              }}
            />
            <IsianTeks
              id={`${idForm}-email`}
              label="Email"
              type="email"
              required
              maxLength={254}
              placeholder="nama@bimbel.test"
              value={email}
              error={galat.email}
              onChange={(event) => {
                setEmail(event.target.value);
                setGalat((sebelumnya) => ({ ...sebelumnya, email: undefined }));
              }}
            />
            <IsianTeks
              id={`${idForm}-sandi`}
              label="Sandi awal"
              type="password"
              required
              minLength={PANJANG_SANDI_MIN}
              maxLength={PANJANG_SANDI_MAKS}
              autoComplete="new-password"
              keterangan={`Minimal ${PANJANG_SANDI_MIN} huruf. Sandi ini hanya disimpan, tidak ditampilkan lagi setelah akunnya dibuat.`}
              value={sandi}
              error={galat.sandi}
              onChange={(event) => {
                setSandi(event.target.value);
                setGalat((sebelumnya) => ({ ...sebelumnya, sandi: undefined }));
              }}
            />
            <IsianPilih
              id={`${idForm}-portal`}
              label="Akses portal"
              keterangan="Nonaktif berarti akunnya dibuat tetapi belum bisa masuk."
              error={galat.aksesPortal}
              value={aksesPortal ? "aktif" : "nonaktif"}
              onChange={(event) => {
                setAksesPortal(event.target.value === "aktif");
                setGalat((sebelumnya) => ({
                  ...sebelumnya,
                  aksesPortal: undefined,
                }));
              }}
            >
              <option value="aktif">Aktif — boleh masuk portal</option>
              <option value="nonaktif">Nonaktif — belum boleh masuk</option>
            </IsianPilih>
          </div>

          {galatUmum && (
            <p role="alert" className="text-sm text-destructive">
              {galatUmum}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              <UserPlus aria-hidden="true" />
              Simpan akun wali
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setNama("");
                setEmail("");
                setSandi("");
                setAksesPortal(true);
                setGalat({});
                setGalatUmum("");
              }}
            >
              Kosongkan
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
