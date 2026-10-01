import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check, X, PackageCheck, PackageOpen, Search, Download, Phone, AlertTriangle, Trash2,
  MessageCircle, Plus,
} from 'lucide-react';

import { api, keQuery } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { useTundaNilai } from '../../hooks/useTundaNilai';
import {
  STATUS_LABEL, STATUS_WARNA, angka, tanggalSingkat, sisaHari, tanggalHariIni,
} from '../../lib/format';
import { tautanWhatsApp } from '../../lib/whatsapp';
import Modal from '../../components/Modal';
import KonfirmasiHapus from '../../components/KonfirmasiHapus';
import { Memuat, PesanGalat, PesanSukses, Kosong } from '../../components/Keadaan';

const PER_HALAMAN = 25;

const SARINGAN = [
  { nilai: '', label: 'Semua' },
  { nilai: 'pending', label: 'Menunggu' },
  { nilai: 'disetujui', label: 'Disetujui' },
  { nilai: 'dipinjam', label: 'Sedang Dipinjam' },
  { nilai: 'dikembalikan', label: 'Sudah Kembali' },
  { nilai: 'ditolak', label: 'Ditolak' },
];

/** Aksi yang tersedia untuk tiap status, sejalan dengan aturan di backend. */
const AKSI_PER_STATUS = {
  pending: [
    { status: 'disetujui', label: 'Setujui', ikon: Check, gaya: 'hover:bg-brand-50 hover:text-brand-700' },
    { status: 'ditolak', label: 'Tolak', ikon: X, gaya: 'hover:bg-rose-50 hover:text-rose-600', mintaCatatan: true },
  ],
  disetujui: [
    { status: 'dipinjam', label: 'Tandai diambil', ikon: PackageOpen, gaya: 'hover:bg-sky-50 hover:text-sky-700' },
    { status: 'dibatalkan', label: 'Batalkan', ikon: X, gaya: 'hover:bg-rose-50 hover:text-rose-600', mintaCatatan: true },
  ],
  dipinjam: [
    { status: 'dikembalikan', label: 'Catat pengembalian', ikon: PackageCheck, gaya: 'hover:bg-slate-100 hover:text-ink-900' },
  ],
};

export default function DataPeminjaman() {
  const [paramUrl, setParamUrl] = useSearchParams();
  const status = paramUrl.get('status') || '';
  const hanyaTerlambat = paramUrl.get('terlambat') === '1';

  const [pencarian, setPencarian] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [aksiTertunda, setAksiTertunda] = useState(null);
  const [akanDihapus, setAkanDihapus] = useState(null);
  const [formCatat, setFormCatat] = useState(false);
  const [pesanSukses, setPesanSukses] = useState('');
  const [pesanUnduh, setPesanUnduh] = useState('');
  const [galatAksi, setGalatAksi] = useState('');

  const kataKunci = useTundaNilai(pencarian);

  const path = useMemo(
    () => `/peminjaman${keQuery({
      status,
      terlambat: hanyaTerlambat ? '1' : '',
      q: kataKunci,
      halaman,
      per_halaman: PER_HALAMAN,
    })}`,
    [status, hanyaTerlambat, kataKunci, halaman]
  );

  const { data, memuat, galat, muatUlang } = useAmbilData(path);
  const daftar = data?.data ?? [];
  const total = data?.halaman?.total ?? 0;
  const totalHalaman = Math.max(Math.ceil(total / PER_HALAMAN), 1);

  function pilihSaringan(nilai) {
    setParamUrl(nilai ? { status: nilai } : {});
    setHalaman(1);
  }

  async function jalankanAksi(item, aksi, catatan) {
    setGalatAksi('');
    try {
      await api.patch(`/peminjaman/${item.id}/status`, {
        status: aksi.status,
        ...(catatan ? { catatan_admin: catatan } : {}),
      });
      muatUlang();
    } catch (err) {
      setGalatAksi(err.message);
    }
  }

  async function unduhLaporan() {
    setPesanUnduh('');
    try {
      await api.unduh(`/laporan/peminjaman.csv${keQuery({ status })}`, 'riwayat-peminjaman.csv');
    } catch (err) {
      setPesanUnduh(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-xl font-bold text-ink-900">Peminjaman</h1>
          <p className="text-sm text-slate-500">
            {angka(total)} pengajuan{hanyaTerlambat ? ' yang terlambat dikembalikan' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button" onClick={unduhLaporan}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download size={16} /> Unduh CSV
          </button>
          <button
            type="button" onClick={() => setFormCatat(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Plus size={18} /> Catat Peminjaman
          </button>
        </div>
      </div>

      <PesanGalat pesan={pesanUnduh} />
      <PesanGalat pesan={galatAksi} />
      <PesanSukses pesan={pesanSukses} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {SARINGAN.map((s) => (
            <button
              key={s.nilai || 'semua'}
              type="button"
              onClick={() => pilihSaringan(s.nilai)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                status === s.nilai && !hanyaTerlambat
                  ? 'bg-ink-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setParamUrl({ terlambat: '1' }); setHalaman(1); }}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              hanyaTerlambat
                ? 'bg-rose-600 text-white'
                : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
            }`}
          >
            <AlertTriangle size={14} /> Terlambat
          </button>
        </div>

        <div className="relative lg:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={pencarian}
            onChange={(e) => { setPencarian(e.target.value); setHalaman(1); }}
            placeholder="Cari nama guru atau kode..."
            aria-label="Cari peminjaman"
            className="input pl-9"
          />
        </div>
      </div>

      <PesanGalat pesan={galat} onCobaLagi={muatUlang} />

      {galat ? null : memuat ? (
        <Memuat />
      ) : daftar.length === 0 ? (
        <Kosong
          judul="Tidak ada pengajuan"
          keterangan="Pengajuan dari guru akan muncul di sini begitu dikirim lewat halaman publik."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-5 py-3">Peminjam</th>
                  <th className="px-5 py-3">Alat</th>
                  <th className="px-5 py-3 text-center">Jumlah</th>
                  <th className="px-5 py-3">Jadwal</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.map((item) => (
                  <BarisPeminjaman
                    key={item.id}
                    item={item}
                    onAksi={(aksi) => {
                      if (aksi.mintaCatatan) setAksiTertunda({ item, aksi });
                      else jalankanAksi(item, aksi);
                    }}
                    onHapus={() => setAkanDihapus(item)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalHalaman > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Halaman {halaman} dari {totalHalaman}</p>
              <div className="flex gap-2">
                <button
                  type="button" onClick={() => setHalaman((h) => h - 1)} disabled={halaman <= 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  type="button" onClick={() => setHalaman((h) => h + 1)} disabled={halaman >= totalHalaman}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <FormCatatPeminjaman
        terbuka={formCatat}
        onTutup={() => setFormCatat(false)}
        onSimpan={(pesan) => {
          setFormCatat(false);
          setPesanSukses(pesan);
          muatUlang();
        }}
      />

      <KonfirmasiHapus
        terbuka={!!akanDihapus}
        judul="Hapus data peminjaman"
        keterangan={
          akanDihapus
            ? `Pengajuan ${akanDihapus.kode_peminjaman} atas nama ${akanDihapus.nama_peminjam} ` +
              `untuk "${akanDihapus.alat?.nama_alat}" akan dihapus permanen, berikut identitas ` +
              'peminjamnya. Baris ini juga akan hilang dari laporan CSV dan grafik dashboard.'
            : ''
        }
        onTutup={() => setAkanDihapus(null)}
        onKonfirmasi={async () => {
          await api.delete(`/peminjaman/${akanDihapus.id}`);
          muatUlang();
        }}
      />

      <DialogCatatan
        tertunda={aksiTertunda}
        onTutup={() => setAksiTertunda(null)}
        onKirim={async (catatan) => {
          await jalankanAksi(aksiTertunda.item, aksiTertunda.aksi, catatan);
          setAksiTertunda(null);
        }}
      />
    </div>
  );
}

function BarisPeminjaman({ item, onAksi, onHapus }) {
  const sisa = sisaHari(item.tanggal_rencana_kembali);
  const terlambat = item.status === 'dipinjam' && sisa < 0;
  const aksi = AKSI_PER_STATUS[item.status] ?? [];

  // Harus sama dengan aturan di backend dan di trigger database.
  const menahanStok = ['disetujui', 'dipinjam'].includes(item.status);
  const tautanWa = tautanWhatsApp(item);

  return (
    <tr className={terlambat ? 'bg-rose-50/50' : 'hover:bg-slate-50'}>
      <td className="px-5 py-3 font-mono text-xs text-slate-500">{item.kode_peminjaman}</td>

      <td className="px-5 py-3">
        <p className="font-medium text-ink-900">{item.nama_peminjam}</p>
        <p className="text-xs text-slate-400">
          {[item.mapel, item.nip_peminjam].filter(Boolean).join(' · ') || '—'}
        </p>
        {item.no_hp && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href={`tel:${item.no_hp.replace(/[^0-9+]/g, '')}`}
              className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"
            >
              <Phone size={11} /> {item.no_hp}
            </a>

            {/* Membuka WhatsApp dengan pesan sudah terisi sesuai statusnya.
                Nomor HP-nya memang sudah terkumpul saat pengajuan, jadi
                tidak perlu layanan pengirim pesan berbayar — petugas
                tinggal menekan kirim. */}
            {tautanWa && (
              <a
                href={tautanWa}
                target="_blank"
                rel="noreferrer"
                title="Kirim pesan WhatsApp sesuai status pengajuan"
                className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                <MessageCircle size={11} /> WhatsApp
              </a>
            )}
          </div>
        )}
      </td>

      <td className="px-5 py-3">
        <p className="text-slate-700">{item.alat?.nama_alat}</p>
        <p className="text-xs text-slate-400">{item.keperluan}</p>
      </td>

      <td className="px-5 py-3 text-center text-slate-600">{item.jumlah}</td>

      <td className="px-5 py-3 text-slate-600">
        <p>{tanggalSingkat(item.tanggal_pinjam)} → {tanggalSingkat(item.tanggal_rencana_kembali)}</p>
        {terlambat && (
          <p className="text-xs font-semibold text-rose-600">Telat {Math.abs(sisa)} hari</p>
        )}
        {item.tanggal_kembali_aktual && (
          <p className="text-xs text-slate-400">Kembali {tanggalSingkat(item.tanggal_kembali_aktual)}</p>
        )}
      </td>

      <td className="px-5 py-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS_WARNA[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
        {item.catatan_admin && (
          <p className="mt-1 max-w-[180px] truncate text-xs text-slate-400" title={item.catatan_admin}>
            {item.catatan_admin}
          </p>
        )}
      </td>

      <td className="px-5 py-3">
        <div className="flex justify-end gap-1">
          {aksi.map((a) => (
            <button
              key={a.status}
              type="button"
              title={a.label}
              onClick={() => onAksi(a)}
              className={`rounded-lg p-2 text-slate-500 ${a.gaya}`}
            >
              <a.ikon size={16} />
              <span className="sr-only">{a.label}</span>
            </button>
          ))}

          {/* Baris yang sedang menahan stok tidak boleh dihapus: alatnya
              masih di tangan guru, dan menghapusnya akan membuat catatan
              stok menyatakan tersedia padahal tidak. */}
          <button
            type="button"
            onClick={onHapus}
            disabled={menahanStok}
            title={
              menahanStok
                ? 'Catat pengembalian atau batalkan dulu sebelum menghapus'
                : 'Hapus data peminjaman'
            }
            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 size={16} />
            <span className="sr-only">Hapus data peminjaman</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

const FORM_CATAT_KOSONG = {
  nama_peminjam: '', nip_peminjam: '', mapel: '', no_hp: '',
  alat_id: '', jumlah: 1, keperluan: '',
  tanggal_pinjam: tanggalHariIni(), tanggal_rencana_kembali: '',
  status: 'dipinjam',
};

/**
 * Pencatatan peminjaman oleh petugas lab untuk guru yang datang langsung.
 *
 * Bedanya dengan form publik: statusnya bisa langsung "dipinjam" karena
 * alatnya diserahkan saat itu juga, dan tanggal pinjam boleh mundur karena
 * petugas kadang baru sempat mencatat kejadian kemarin.
 */
function FormCatatPeminjaman({ terbuka, onTutup, onSimpan }) {
  const { data: dataAlat } = useAmbilData('/alat?ketersediaan=tersedia&per_halaman=200', {
    aktif: terbuka,
  });
  const daftarAlat = (dataAlat?.data ?? []).filter((a) => a.boleh_dipinjam);

  const [form, setForm] = useState(FORM_CATAT_KOSONG);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [pernahTerbuka, setPernahTerbuka] = useState(false);

  if (terbuka !== pernahTerbuka) {
    setPernahTerbuka(terbuka);
    if (terbuka) { setForm(FORM_CATAT_KOSONG); setGalat(''); }
  }

  const alatDipilih = daftarAlat.find((a) => a.id === form.alat_id);

  function ubah(kunci) {
    return (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }));
  }

  async function simpan(e) {
    e.preventDefault();
    setGalat('');
    setMenyimpan(true);
    try {
      const res = await api.post('/peminjaman/catat', { ...form, jumlah: Number(form.jumlah) });
      onSimpan(res.pesan || 'Peminjaman tercatat.');
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMenyimpan(false);
    }
  }

  return (
    <Modal terbuka={terbuka} judul="Catat Peminjaman" onTutup={onTutup} lebar="max-w-2xl">
      <form onSubmit={simpan} className="space-y-4">
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Untuk guru yang datang langsung ke lab. Pengajuan ini tidak perlu
          ditinjau lagi — langsung tercatat atas nama Anda.
        </p>

        <PesanGalat pesan={galat} />

        <div className="grid gap-4 sm:grid-cols-2">
          <IsianCatat label="Nama peminjam" wajib>
            <input required maxLength={120} value={form.nama_peminjam}
              onChange={ubah('nama_peminjam')} className="input" placeholder="Rina Kusumawati, S.Pd." />
          </IsianCatat>
          <IsianCatat label="Nomor HP" wajib>
            <input required type="tel" maxLength={20} value={form.no_hp}
              onChange={ubah('no_hp')} className="input" placeholder="08xxxxxxxxxx" />
          </IsianCatat>
          <IsianCatat label="NIP / NUPTK">
            <input maxLength={30} value={form.nip_peminjam} onChange={ubah('nip_peminjam')} className="input" />
          </IsianCatat>
          <IsianCatat label="Mata pelajaran">
            <input maxLength={80} value={form.mapel} onChange={ubah('mapel')} className="input" placeholder="IPA" />
          </IsianCatat>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <IsianCatat label="Alat" wajib>
              <select required value={form.alat_id} onChange={ubah('alat_id')} className="input">
                <option value="">Pilih alat</option>
                {daftarAlat.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nama_alat} — tersedia {a.jumlah_tersedia}
                  </option>
                ))}
              </select>
            </IsianCatat>
          </div>
          <IsianCatat label="Jumlah" wajib>
            <input required type="number" min={1} max={alatDipilih?.jumlah_tersedia || undefined}
              value={form.jumlah} onChange={ubah('jumlah')} className="input" />
          </IsianCatat>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <IsianCatat label="Tanggal pinjam" wajib>
            <input required type="date" value={form.tanggal_pinjam}
              onChange={ubah('tanggal_pinjam')} className="input" />
          </IsianCatat>
          <IsianCatat label="Rencana kembali" wajib>
            <input required type="date" min={form.tanggal_pinjam}
              value={form.tanggal_rencana_kembali} onChange={ubah('tanggal_rencana_kembali')} className="input" />
          </IsianCatat>
        </div>

        <IsianCatat label="Keperluan" wajib>
          <textarea required rows={2} maxLength={500} value={form.keperluan}
            onChange={ubah('keperluan')} className="input"
            placeholder="Praktikum kelas VIII A, materi rangkaian listrik" />
        </IsianCatat>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-xs font-semibold text-slate-600">Keadaan alat sekarang</legend>
          <div className="space-y-2">
            <label className="flex items-start gap-3 text-sm">
              <input type="radio" name="status" value="dipinjam" checked={form.status === 'dipinjam'}
                onChange={ubah('status')} className="mt-0.5 h-4 w-4 text-brand-600 focus:ring-brand-500" />
              <span>
                Alatnya sudah dibawa guru
                <span className="block text-xs text-slate-500">Langsung tercatat sedang dipinjam.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="radio" name="status" value="disetujui" checked={form.status === 'disetujui'}
                onChange={ubah('status')} className="mt-0.5 h-4 w-4 text-brand-600 focus:ring-brand-500" />
              <span>
                Disetujui, diambil menyusul
                <span className="block text-xs text-slate-500">
                  Stok tetap ditahan. Tandai diambil nanti lewat tombol di tabel.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onTutup}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Batal
          </button>
          <button type="submit" disabled={menyimpan}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {menyimpan ? 'Menyimpan...' : 'Catat Peminjaman'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function IsianCatat({ label, wajib, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {wajib && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function DialogCatatan({ tertunda, onTutup, onKirim }) {
  const [catatan, setCatatan] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [idTerakhir, setIdTerakhir] = useState(null);

  const penanda = tertunda ? `${tertunda.item.id}-${tertunda.aksi.status}` : null;
  if (penanda !== idTerakhir) {
    setIdTerakhir(penanda);
    setCatatan('');
  }

  async function kirim(e) {
    e.preventDefault();
    setMengirim(true);
    try {
      await onKirim(catatan.trim());
    } finally {
      setMengirim(false);
    }
  }

  return (
    <Modal
      terbuka={!!tertunda}
      judul={tertunda ? `${tertunda.aksi.label} pengajuan` : ''}
      onTutup={onTutup}
      lebar="max-w-md"
    >
      {tertunda && (
        <form onSubmit={kirim} className="space-y-4">
          <p className="text-sm text-slate-600">
            Pengajuan <span className="font-mono text-xs">{tertunda.item.kode_peminjaman}</span> atas
            nama <strong>{tertunda.item.nama_peminjam}</strong> untuk{' '}
            <strong>{tertunda.item.alat?.nama_alat}</strong>.
          </p>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Alasan / catatan untuk guru
            </span>
            <textarea
              rows={3} maxLength={500} value={catatan} onChange={(e) => setCatatan(e.target.value)}
              className="input"
              placeholder="Contoh: Alat sedang diperbaiki, silakan ajukan minggu depan."
            />
            <span className="mt-1 block text-xs text-slate-400">
              Catatan ini akan terlihat oleh guru saat melacak pengajuannya.
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button" onClick={onTutup}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit" disabled={mengirim}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {mengirim ? 'Memproses...' : tertunda.aksi.label}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
