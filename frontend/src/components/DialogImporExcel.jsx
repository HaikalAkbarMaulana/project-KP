import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';

import Modal from './Modal';
import { PesanGalat } from './Keadaan';

/**
 * Dialog impor dari berkas Excel.
 *
 * Dipakai bersama oleh impor akun guru dan impor data inventaris. Yang
 * membedakan keduanya hanya susunan kolom, cara membaca barisnya, dan
 * endpoint tujuannya — semuanya diserahkan lewat prop, sehingga alur
 * unggah, pratinjau, dan laporan hasilnya tidak punya dua salinan yang
 * bisa menyimpang satu sama lain.
 *
 * Berkasnya dibaca di browser, bukan diunggah mentah ke server. SheetJS
 * dimuat hanya saat dialog ini dipakai, karena pustakanya cukup besar
 * sementara impor hanya dilakukan sesekali.
 */
export default function DialogImporExcel({
  terbuka,
  onTutup,
  onSelesai,
  judul,
  kolom,
  kolomWajib = [],
  namaLembar,
  namaTemplat,
  buatTemplat,
  bacaBaris,
  kirim,
  kolomPratinjau,
  maksBaris,
  petunjuk = null,
  penghalang = null,
}) {
  const [baris, setBaris] = useState(null);
  const [namaBerkas, setNamaBerkas] = useState('');
  const [hasil, setHasil] = useState(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const halangan = baris && penghalang ? penghalang(baris) : null;

  function tutup() {
    setBaris(null);
    setNamaBerkas('');
    setHasil(null);
    setGalat('');
    onTutup();
  }

  async function bacaBerkas(berkas) {
    setGalat('');
    setHasil(null);
    setBaris(null);
    setNamaBerkas(berkas.name);

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await berkas.arrayBuffer(), { type: 'array' });
      const lembar = wb.Sheets[wb.SheetNames[0]];
      if (!lembar) throw new Error('Berkas tidak punya lembar kerja.');

      // raw:true dipertahankan supaya sel bertipe angka tetap terbaca sebagai
      // angka — itulah tanda nilai yang sudah diubah Excel. Dengan raw:false
      // angka besar justru menyamar jadi teks "1.98005E+17".
      const terbaca = bacaBaris(XLSX.utils.sheet_to_json(lembar, { defval: '', raw: true }));

      if (terbaca.length === 0) {
        throw new Error(
          `Tidak ada baris yang terbaca. Pastikan judul kolomnya ada, minimal: ${kolomWajib.join(', ')}.`
        );
      }
      setBaris(terbaca);
    } catch (err) {
      setGalat(`Gagal membaca berkas: ${err.message}`);
    }
  }

  async function unggah() {
    setSibuk(true);
    setGalat('');
    try {
      const res = await kirim(baris);
      setHasil(res.data);
      onSelesai?.();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setSibuk(false);
    }
  }

  async function unduhTemplat() {
    const XLSX = await import('xlsx');
    XLSX.writeFile(buatTemplat(XLSX), namaTemplat);
  }

  return (
    <Modal terbuka={terbuka} judul={judul} onTutup={tutup} lebar="max-w-3xl">
      <div className="space-y-4">
        {!hasil && (
          <>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                Kolom wajib:{' '}
                {kolomWajib.map((k, i) => (
                  <span key={k}>
                    {i > 0 && ', '}
                    <span className="font-mono text-xs font-semibold text-ink-900">{k}</span>
                  </span>
                ))}
                . Kolom lainnya boleh dikosongkan.
              </p>
              {petunjuk}
              <button
                type="button"
                onClick={unduhTemplat}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                <Download size={15} /> Unduh templat Excel
              </button>
            </div>

            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
              <FileSpreadsheet size={28} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">
                {namaBerkas || 'Pilih berkas Excel (.xlsx atau .xls)'}
              </span>
              <span className="text-xs text-slate-400">Maksimal {maksBaris} baris sekali unggah</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const berkas = e.target.files?.[0];
                  if (berkas) bacaBerkas(berkas);
                  // Dikosongkan agar memilih berkas yang sama dua kali tetap
                  // memicu pembacaan ulang.
                  e.target.value = '';
                }}
              />
            </label>

            <PesanGalat pesan={galat} />

            {halangan && (
              <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200">
                <p className="font-semibold">{halangan.judul}</p>
                <p className="mt-1">{halangan.pesan}</p>
                {halangan.nomorBaris?.length > 0 && (
                  <p className="mt-2 text-xs">Baris di Excel: {halangan.nomorBaris.join(', ')}.</p>
                )}
              </div>
            )}

            {baris && (
              <>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-ink-900">{baris.length} baris</span> terbaca dari
                  berkas. Periksa sekilas, lalu lanjutkan.
                </p>
                <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {kolomPratinjau.map((k) => (
                          <th key={k.kunci} className="whitespace-nowrap px-3 py-2">{k.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {baris.slice(0, 10).map((r, i) => (
                        <tr key={i}>
                          {kolomPratinjau.map((k) => (
                            <td key={k.kunci} className="px-3 py-1.5">
                              {r[k.kunci] === null || r[k.kunci] === '' ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                String(k.tampil ? k.tampil(r[k.kunci]) : r[k.kunci])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {baris.length > 10 && (
                  <p className="text-xs text-slate-400">
                    Menampilkan 10 baris pertama dari {baris.length}.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {hasil && <LaporanImpor hasil={hasil} />}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={tutup}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {hasil ? 'Tutup' : 'Batal'}
          </button>
          {!hasil && (
            <button
              type="button"
              onClick={unggah}
              disabled={!baris || sibuk || !!halangan}
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {sibuk ? 'Menyimpan...' : `Simpan ${baris?.length ?? 0} baris`}
            </button>
          )}
        </div>

        {sibuk && (
          <p className="text-xs text-slate-500">
            Baris disimpan satu per satu, jadi berkas yang panjang butuh waktu. Jangan tutup
            jendela ini dulu.
          </p>
        )}
      </div>
    </Modal>
  );
}

function LaporanImpor({ hasil }) {
  const { ringkasan, baris } = hasil;
  const bermasalah = baris.filter((b) => b.status !== 'berhasil');

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Angka label="Berhasil" nilai={ringkasan.dibuat} kelas="bg-brand-50 text-brand-700" />
        <Angka label="Dilewati" nilai={ringkasan.dilewati} kelas="bg-amber-50 text-amber-700" />
        <Angka label="Gagal" nilai={ringkasan.gagal} kelas="bg-rose-50 text-rose-700" />
      </div>

      {bermasalah.length === 0 ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Semua baris berhasil disimpan.
        </p>
      ) : (
        <>
          <p className="text-sm font-medium text-ink-900">
            Baris yang perlu diperiksa ({bermasalah.length}):
          </p>
          <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Baris</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bermasalah.map((b) => (
                  <tr key={b.nomor} className={b.status === 'gagal' ? 'bg-rose-50/40' : ''}>
                    <td className="px-3 py-1.5 font-mono text-xs">{b.nomor}</td>
                    <td className="px-3 py-1.5">{b.nama || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-1.5 text-slate-600">{b.pesan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Nomor baris mengikuti nomor di Excel. Betulkan baris itu saja lalu unggah ulang
            berkasnya — yang sudah tersimpan akan dilewati, tidak dobel.
          </p>
        </>
      )}
    </div>
  );
}

function Angka({ label, nilai, kelas }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${kelas}`}>
      <p className="font-display text-xl font-bold">{nilai}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
