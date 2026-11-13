import { useEffect, useMemo, useState } from 'react';
import { Printer, Download, Save, ChevronDown, ChevronUp } from 'lucide-react';

import { api, keQuery } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { STATUS_LABEL, angka, tanggalSingkat } from '../../lib/format';
import { Memuat, PesanGalat, Kosong } from '../../components/Keadaan';
import LogoSekolah from '../../components/LogoSekolah';

// Nama penanda tangan tetap di peramban: isinya memang berbeda-beda
// menurut siapa yang mencetak. Identitas sekolah sebaliknya milik sekolah,
// jadi dipindahkan ke database lewat /api/identitas.
const KUNCI_PENANDA = 'labpinjam.penanda-tangan';

/** Dipakai sementara selagi identitas dari server belum tiba. */
const IDENTITAS_KOSONG = {
  pemerintah: '', dinas: '', nama_sekolah: '', alamat: '',
  telepon: '', laman: '', posel: '', kota: '',
};

const ISIAN_KOP = [
  ['pemerintah', 'Pemerintah daerah', 'PEMERINTAH KABUPATEN CILACAP'],
  ['dinas', 'Dinas', 'DINAS PENDIDIKAN DAN KEBUDAYAAN'],
  ['nama_sekolah', 'Nama sekolah', 'SMP NEGERI 3 KEDUNGREJA'],
  ['alamat', 'Alamat', 'Jalan ... , Kedungreja, Cilacap 53263'],
  ['telepon', 'Telepon', 'Telepon 08xxxxxxxxxx'],
  ['laman', 'Laman', 'smpn3kedungreja.sch.id'],
  ['posel', 'Pos-el', 'smpn3kedungreja@gmail.com'],
  ['kota', 'Kota penandatanganan', 'Kedungreja'],
];

/** Awal dan akhir bulan berjalan, dalam waktu setempat. */
function bulanIni() {
  const kini = new Date();
  const awal = new Date(kini.getFullYear(), kini.getMonth(), 1);
  const akhir = new Date(kini.getFullYear(), kini.getMonth() + 1, 0);
  const ke = (d) => d.toLocaleDateString('sv-SE');
  return { dari: ke(awal), sampai: ke(akhir) };
}

/**
 * Membaca nilai yang pernah disimpan di perangkat ini.
 *
 * Alamat sekolah dan nama penanda tangan disimpan di browser, bukan di
 * database, karena isinya hanya dipakai untuk kop surat dan berbeda-beda
 * menurut siapa yang mencetak. Dibungkus try/catch karena sebagian browser
 * sekolah menolak penyimpanan lokal.
 */
function bacaSimpanan(kunci, bawaan) {
  try {
    return localStorage.getItem(kunci) ?? bawaan;
  } catch {
    return bawaan;
  }
}

function simpan(kunci, nilai) {
  try {
    localStorage.setItem(kunci, nilai);
  } catch {
    // Tidak apa-apa; isian tetap bisa dipakai untuk cetakan kali ini.
  }
}

export default function Laporan() {
  const bawaan = bulanIni();
  const [dari, setDari] = useState(bawaan.dari);
  const [sampai, setSampai] = useState(bawaan.sampai);
  const [penandaTangan, setPenandaTangan] = useState(() => bacaSimpanan(KUNCI_PENANDA, ''));
  const [pesanUnduh, setPesanUnduh] = useState('');
  const [identitas, setIdentitas] = useState(IDENTITAS_KOSONG);
  const [pesanKop, setPesanKop] = useState('');
  const [galatKop, setGalatKop] = useState('');
  const [menyimpanKop, setMenyimpanKop] = useState(false);
  const [kopTerbuka, setKopTerbuka] = useState(false);

  // Identitas dibaca sekali saat halaman dibuka. Kegagalan sengaja tidak
  // ditampilkan sebagai galat besar: laporannya tetap bisa dicetak, hanya
  // kop suratnya kosong.
  useEffect(() => {
    let aktif = true;
    api.get('/identitas')
      .then((res) => { if (aktif) setIdentitas({ ...IDENTITAS_KOSONG, ...(res.data ?? {}) }); })
      .catch(() => {});
    return () => { aktif = false; };
  }, []);

  async function simpanKop() {
    setPesanKop(''); setGalatKop(''); setMenyimpanKop(true);
    try {
      const res = await api.put('/identitas', identitas);
      if (res.data) setIdentitas({ ...IDENTITAS_KOSONG, ...res.data });
      setPesanKop(res.pesan || 'Kop surat berhasil disimpan.');
    } catch (err) {
      setGalatKop(err.message);
    } finally {
      setMenyimpanKop(false);
    }
  }

  const ubahKop = (kolom) => (e) => {
    setPesanKop('');
    setIdentitas((lama) => ({ ...lama, [kolom]: e.target.value }));
  };

  const path = useMemo(() => `/laporan/rekap${keQuery({ dari, sampai })}`, [dari, sampai]);
  const { data, memuat, galat, muatUlang } = useAmbilData(path);
  const laporan = data?.data;

  async function unduhCsv() {
    setPesanUnduh('');
    try {
      await api.unduh(
        `/laporan/peminjaman.csv${keQuery({ dari, sampai })}`,
        `riwayat-peminjaman-${dari}-sd-${sampai}.csv`
      );
    } catch (err) {
      setPesanUnduh(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="tanpa-cetak space-y-4">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Laporan Peminjaman</h1>
          <p className="text-sm text-slate-500">
            Rekap untuk dilaporkan ke kepala sekolah. Atur periodenya, lalu cetak.
          </p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Dari tanggal</span>
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Sampai tanggal</span>
            <input type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Penanda tangan</span>
            <input
              value={penandaTangan}
              onChange={(e) => { setPenandaTangan(e.target.value); simpan(KUNCI_PENANDA, e.target.value); }}
              className="input" placeholder="Nama petugas lab"
            />
          </label>
        </div>

        {/* Kop surat disembunyikan di balik tombol karena jarang diubah:
            sekali disetel saat sistem dipasang, lalu dibiarkan. */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setKopTerbuka((t) => !t)}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-ink-900">Kop surat laporan</span>
              <span className="block text-xs text-slate-500">
                {identitas.nama_sekolah || 'Belum disetel'} — berlaku untuk semua petugas
              </span>
            </span>
            {kopTerbuka ? <ChevronUp size={18} className="shrink-0 text-slate-400" />
                        : <ChevronDown size={18} className="shrink-0 text-slate-400" />}
          </button>

          {kopTerbuka && (
            <div className="border-t border-slate-200 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {ISIAN_KOP.map(([kolom, label, contoh]) => (
                  <label key={kolom} className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
                    <input
                      value={identitas[kolom] ?? ''}
                      onChange={ubahKop(kolom)}
                      className="input" placeholder={contoh}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button" onClick={simpanKop} disabled={menyimpanKop}
                  className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  <Save size={16} /> {menyimpanKop ? 'Menyimpan...' : 'Simpan kop surat'}
                </button>
                {pesanKop && <span className="text-sm text-emerald-700">{pesanKop}</span>}
              </div>

              <div className="mt-3">
                <PesanGalat pesan={galatKop} />
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Lambang kabupaten dan logo sekolah diambil dari berkas
                frontend/public/logo-kabupaten.png dan logo-sekolah.png.
                Ganti kedua berkas itu bila sistem dipakai sekolah lain.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button" onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Printer size={16} /> Cetak laporan
          </button>
          <button
            type="button" onClick={unduhCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={16} /> Unduh rinciannya (CSV)
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Kop surat tersimpan di database sehingga berlaku untuk semua petugas.
          Nama penanda tangan tersimpan di browser ini saja, karena berbeda
          menurut siapa yang mencetak.
        </p>

        <PesanGalat pesan={pesanUnduh} />
        <PesanGalat pesan={galat} onCobaLagi={muatUlang} />
      </div>

      {galat ? null : memuat ? (
        <Memuat pesan="Menyusun laporan..." />
      ) : (
        <IsiLaporan
          laporan={laporan}
          identitas={identitas}
          penandaTangan={penandaTangan}
        />
      )}
    </div>
  );
}

function IsiLaporan({ laporan, identitas, penandaTangan }) {
  if (!laporan) return null;
  const { periode, ringkasan, perAlat, daftar } = laporan;

  const hariIni = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {/* Kop surat: lambang kabupaten di kiri, logo sekolah di kanan,
          tulisan rata tengah di antaranya -- mengikuti kop surat resmi
          sekolah. Seluruh barisnya dibaca dari tabel identitas_sekolah. */}
      <header className="border-b-4 border-double border-ink-900 pb-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            src="/logo-kabupaten.png" alt="Lambang Kabupaten Cilacap"
            width={80} height={99}
            className="h-14 w-auto shrink-0 object-contain sm:h-20"
          />
          <div className="min-w-0 flex-1 text-center leading-snug">
            {identitas.pemerintah && (
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-900 sm:text-base">
                {identitas.pemerintah}
              </p>
            )}
            {identitas.dinas && (
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-900 sm:text-base">
                {identitas.dinas}
              </p>
            )}
            {identitas.nama_sekolah && (
              <h2 className="font-display text-lg font-bold uppercase text-ink-900 sm:text-2xl">
                {identitas.nama_sekolah}
              </h2>
            )}
            {identitas.alamat && <p className="text-xs text-slate-600">{identitas.alamat}</p>}
            {identitas.telepon && <p className="text-xs text-slate-600">{identitas.telepon}</p>}
            {(identitas.laman || identitas.posel) && (
              <p className="text-xs text-slate-600">
                {identitas.laman && <>Laman : {identitas.laman}</>}
                {identitas.laman && identitas.posel && <>{'  '}</>}
                {identitas.posel && <>Pos-el : {identitas.posel}</>}
              </p>
            )}
          </div>
          <LogoSekolah ukuran={80} kelas="h-14 w-14 shrink-0 sm:h-20 sm:w-20" />
        </div>
      </header>

      <div className="mt-6 text-center">
        <h3 className="font-display text-base font-bold uppercase underline">
          Laporan Peminjaman Alat Laboratorium
        </h3>
        <p className="text-sm text-slate-600">
          Periode {tanggalSingkat(periode.dari)} — {tanggalSingkat(periode.sampai)}
        </p>
      </div>

      {ringkasan.totalPengajuan === 0 ? (
        <div className="mt-8">
          <Kosong
            judul="Tidak ada peminjaman pada periode ini"
            keterangan="Coba ubah rentang tanggalnya."
          />
        </div>
      ) : (
        <>
          <Bagian judul="A. Ringkasan">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Angka label="Jumlah pengajuan" nilai={angka(ringkasan.totalPengajuan)} />
              <Angka label="Jumlah peminjam" nilai={angka(ringkasan.jumlahPeminjam)} satuan="orang" />
              <Angka label="Total unit dipinjam" nilai={angka(ringkasan.totalUnit)} satuan="unit" />
              <Angka label="Sudah dikembalikan" nilai={angka(ringkasan.perStatus.dikembalikan)} />
              <Angka label="Masih dipinjam" nilai={angka(ringkasan.perStatus.dipinjam)} />
              <Angka label="Ditolak / dibatalkan"
                nilai={angka(ringkasan.perStatus.ditolak + ringkasan.perStatus.dibatalkan)} />
              <Angka label="Unit rusak saat kembali" nilai={angka(ringkasan.unitRusak)} satuan="unit" />
              <Angka label="Unit hilang" nilai={angka(ringkasan.unitHilang)} satuan="unit" />
            </div>
          </Bagian>

          <Bagian judul="B. Rekapitulasi per Alat">
            <Tabel
              kepala={['No', 'Kode', 'Nama Alat', 'Kali Dipinjam', 'Total Unit', 'Rusak', 'Hilang']}
              baris={perAlat.map((a, i) => [
                i + 1, a.kode, a.nama, a.kali, a.unit,
                a.rusak || '-', a.hilang || '-',
              ])}
              rata={['center', 'left', 'left', 'center', 'center', 'center', 'center']}
            />
          </Bagian>

          <Bagian judul="C. Rincian Peminjaman">
            <Tabel
              kepala={['No', 'Kode', 'Peminjam', 'Alat', 'Jml', 'Pinjam', 'Kembali', 'Status']}
              baris={daftar.map((p, i) => [
                i + 1,
                p.kode_peminjaman,
                p.nama_peminjam + (p.mapel ? ` (${p.mapel})` : ''),
                p.alat?.nama_alat || '-',
                p.jumlah,
                tanggalSingkat(p.tanggal_pinjam),
                p.tanggal_kembali_aktual ? tanggalSingkat(p.tanggal_kembali_aktual) : '-',
                STATUS_LABEL[p.status],
              ])}
              rata={['center', 'left', 'left', 'left', 'center', 'center', 'center', 'center']}
            />
          </Bagian>
        </>
      )}

      {/* Ruang tanda tangan */}
      <div className="mt-10 flex justify-end">
        <div className="text-center text-sm">
          <p>{identitas.kota || 'Kedungreja'}, {hariIni}</p>
          <p className="mt-1">Petugas Laboratorium,</p>
          <div className="h-16" />
          <p className="font-semibold underline">{penandaTangan || '(...............................)'}</p>
        </div>
      </div>
    </article>
  );
}

function Bagian({ judul, children }) {
  return (
    <section className="mt-6">
      <h4 className="font-display mb-2 text-sm font-bold text-ink-900">{judul}</h4>
      {children}
    </section>
  );
}

function Angka({ label, nilai, satuan }) {
  return (
    <div className="flex justify-between gap-2 border-b border-dotted border-slate-200 py-1">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-ink-900">
        {nilai}{satuan && <span className="font-normal text-slate-500"> {satuan}</span>}
      </span>
    </div>
  );
}

// Kelas perataan ditulis utuh, bukan dirangkai seperti `text-${rata}`.
// Tailwind membangun CSS dengan memindai kode sumber, jadi nama kelas yang
// baru terbentuk saat program berjalan tidak akan pernah dibuatkan gayanya.
const KELAS_RATA = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function Tabel({ kepala, baris, rata }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            {kepala.map((k, i) => (
              <th
                key={k}
                className={`border border-slate-300 px-2 py-1.5 font-semibold ${KELAS_RATA[rata[i]]}`}
              >
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {baris.map((b, i) => (
            <tr key={i}>
              {b.map((sel, j) => (
                <td key={j} className={`border border-slate-300 px-2 py-1 ${KELAS_RATA[rata[j]]}`}>
                  {sel}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
