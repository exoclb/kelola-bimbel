import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  judulJenisNotifikasi,
  type HasilUjiPeristiwa,
} from "@/lib/mock-verifikasi-notifikasi";

type HasilUjiPerPeristiwaProps = {
  /** Peristiwa yang mengirim pemberitahuan, urut mengikuti alur pemakaian. */
  peristiwa: HasilUjiPeristiwa[];
};

/**
 * Tabel hasil uji per peristiwa: untuk setiap titik tulis yang mengirim
 * pemberitahuan, ditampilkan jenisnya, penerimanya, kunci anti-duplikasinya,
 * dan nama tes yang mengunci perilakunya. Satu baris = satu peristiwa, jadi
 * perbedaan cara penjagaannya (kunci per periode vs pemeriksaan jurnal yang
 * sudah ada) terlihat berdampingan. Komponennya presentasional, tanpa "use
 * client".
 */
export function HasilUjiPerPeristiwa({
  peristiwa,
}: HasilUjiPerPeristiwaProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hasil uji per peristiwa</CardTitle>
        <CardDescription>
          Titik tulis mana yang mengirim pemberitahuan, siapa penerimanya, apa
          kunci anti-duplikasinya, dan tes mana yang menguncinya.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Peristiwa
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Jenis
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Penerima
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Kunci peristiwa
                </th>
                <th scope="col" className="py-2 font-medium">
                  Tes pengunci
                </th>
              </tr>
            </thead>
            <tbody>
              {peristiwa.map((item) => (
                <tr
                  key={item.id}
                  className="border-b align-top last:border-0"
                >
                  <td className="py-3 pr-4">
                    <p className="font-medium">{item.peristiwa}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      <code>{item.pemicu}</code>
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    {judulJenisNotifikasi(item.jenis)}
                  </td>
                  <td className="py-3 pr-4">{item.penerima}</td>
                  <td className="py-3 pr-4">
                    {item.kunci ? (
                      <code>{item.kunci}</code>
                    ) : (
                      <span className="text-muted-foreground">
                        Tanpa kunci
                      </span>
                    )}
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.penjaga}
                    </p>
                  </td>
                  <td className="py-3">
                    <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                      {item.tes.map((tes) => (
                        <li key={tes}>{tes}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Kelas kosong tidak masuk tabel karena belum ada satu pun bagian
          aplikasi yang mengirimkannya; jenisnya masih terdaftar di preferensi
          dan menunggu diputuskan.
        </p>
      </CardContent>
    </Card>
  );
}
