import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Boxes, ArrowLeft, PackageSearch, Copy, Check, Info } from 'lucide-react';

import { api } from '../../lib/api';
import { useAmbilData } from '../../hooks/useAmbilData';
import { tanggalHariIni } from '../../lib/format';
import { Memuat, PesanGalat } from '../../components/Keadaan';

const FORM_KOSONG = {
  nama_peminjam: '',
  nip_peminjam: '',
  mapel: '',
  no_hp: '',
  jumlah: 1,
  keperluan: '',
  tanggal_pinjam: tanggalHariIni(),
  tanggal_rencana_kembali: '',
};

export default function DetailAlat() {
  const { id } = useParams();
  const { data, memuat, galat, muatUlang } = useAmbilData(`/alat/${id}`);
  const alat = data?.data;

  if (memuat) return <Memuat />;

  if (galat) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <PesanGalat pesan={galat} onCobaLagi={muatUlang} />
        <Link to="/" className="mt-4 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
          <ArrowLeft size={16} /> Kembali ke katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700">
        <ArrowLeft size={16} /> Kembali ke katalog alat
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex h-56 items-center justify-center overflow-hidden rounded-2xl bg-brand-50">
            {alat.foto_url
              ? <img src={alat.foto_url} alt={alat.nama_alat} className="h-full w-full object-cover" />
              : <PackageSearch size={64} className="text-brand-400" />}
          </div>

          <h1 className="font-display mt-5 text-2xl font-bold text-ink-900">{alat.nama_alat}</h1>
          {alat.merk_tipe && <p className="text-sm text-slate-500">{alat.merk_tipe}</p>}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1"><MapPin size={14} /> {alat.ruangan?.nama_ruangan || '-'}</span>
            <span className="flex items-center gap-1"><Boxes size={14} /> {alat.kategori?.nama_kategori || '-'}</span>
          </div>

          {alat.deskripsi && <p className="mt-4 text-sm leading-relaxed text-slate-600">{alat.deskripsi}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
            <Rincian label="Kode alat" nilai={<span className="font-mono text-xs">{alat.kode_alat}</span>} />
            <Rincian label="Total unit" nilai={alat.jumlah_total} />
            <Rincian
              label="Bisa dipinjam"
              nilai={<span className="font-semibold text-brand-700">{alat.jumlah_tersedia}</span>}
            />
            <Rincian
              label="Rusak"
              nilai={<span className={alat.jumlah_rusak > 0 ? 'text-amber-600' : ''}>{alat.jumlah_rusak}</span>}
            />
          </dl>
        </div>

        <div className="lg:col-span-3">
          <FormPengajuan alat={alat} onBerhasilAjukan={muatUlang} />
        </div>
      </div>
    </div>
  );
}

function Rincian({ label, nilai }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-ink-900">{nilai}</dd>
    </div>
  );
}

function FormPengajuan({ alat, onBerhasilAjukan }) {
  const [form, setForm] = useState(FORM_KOSONG);
  const [galat, setGalat] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [kodeBerhasil, setKodeBerhasil] = useState('');

  const bisaDipinjam = alat.boleh_dipinjam && alat.jumlah_tersedia > 0;

  function ubah(kunci) {
    return (e) => setForm((f) => ({ ...f, [kunci]: e.target.value }));
  }

  async function kirim(e) {
    e.preventDefault();
    setGalat('');
    setMengirim(true);

    try {
      const res = await api.post('/peminjaman', {
        ...form,
        alat_id: alat.id,
        jumlah: Number(form.jumlah),
      });
      setKodeBerhasil(res.data.kode_peminjaman);
      setForm(FORM_KOSONG);
      onBerhasilAjukan();
    } catch (err) {
      setGalat(err.message);
    } finally {
      setMengirim(false);
    }
  }

  if (kodeBerhasil) {
    return <PengajuanTerkirim kode={kodeBerhasil} onAjukanLagi={() => setKodeBerhasil('')} />;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-bold text-ink-900">Ajukan Peminjaman</h2>
      <p className="mt-1 text-sm text-slate-500">
        Isi data di bawah ini. Tidak perlu membuat akun — setelah terkirim Anda akan
        mendapat kode untuk melacak statusnya.
      </p>

      {!alat.boleh_dipinjam && (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info size={16} className="mt-px shrink-0" />
          Alat ini tidak dipinjamkan keluar lab. Silakan hubungi petugas lab bila tetap diperlukan.
        </p>
      )}

      {alat.boleh_dipinjam && alat.jumlah_tersedia === 0 && (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info size={16} className="mt-px shrink-0" />
          Semua unit sedang dipinjam. Coba lagi setelah ada yang dikembalikan.
        </p>
      )}

      <form onSubmit={kirim} className="mt-5 space-y-4">
        <PesanGalat pesan={galat} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Isian label="Nama lengkap" wajib>
            <input
              required maxLength={120} value={form.nama_peminjam}
              onChange={ubah('nama_peminjam')} className="input" placeholder="Contoh: Rina Kusumawati, S.Pd."
            />
          </Isian>
          <Isian label="NIP / NUPTK">
            <input
              maxLength={30} value={form.nip_peminjam}
              onChange={ubah('nip_peminjam')} className="input" placeholder="Opsional"
            />
          </Isian>
          <Isian label="Mata pelajaran">
            <input
              maxLength={80} value={form.mapel}
              onChange={ubah('mapel')} className="input" placeholder="Contoh: IPA"
            />
          </Isian>
          <Isian label="Nomor HP aktif" wajib>
            <input
              required type="tel" inputMode="tel" maxLength={20} value={form.no_hp}
              onChange={ubah('no_hp')} className="input" placeholder="08xxxxxxxxxx"
            />
          </Isian>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Isian label="Jumlah" wajib>
            <input
              required type="number" min={1} max={Math.max(alat.jumlah_tersedia, 1)}
              value={form.jumlah} onChange={ubah('jumlah')} className="input"
            />
          </Isian>
          <Isian label="Tanggal pinjam" wajib>
            <input
              required type="date" min={tanggalHariIni()} value={form.tanggal_pinjam}
              onChange={ubah('tanggal_pinjam')} className="input"
            />
          </Isian>
          <Isian label="Rencana kembali" wajib>
            <input
              required type="date" min={form.tanggal_pinjam || tanggalHariIni()}
              value={form.tanggal_rencana_kembali}
              onChange={ubah('tanggal_rencana_kembali')} className="input"
            />
          </Isian>
        </div>

        <Isian label="Keperluan" wajib>
          <textarea
            required rows={3} maxLength={500} value={form.keperluan}
            onChange={ubah('keperluan')} className="input"
            placeholder="Contoh: Praktikum kelas VIII A, materi rangkaian listrik"
          />
        </Isian>

        <button
          type="submit"
          disabled={mengirim || !bisaDipinjam}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mengirim ? 'Mengirim...' : 'Kirim Pengajuan'}
        </button>

        <p className="text-center text-xs text-slate-400">
          Data yang Anda isi hanya dipakai petugas lab untuk memproses peminjaman ini.
        </p>
      </form>
    </div>
  );
}

function PengajuanTerkirim({ kode, onAjukanLagi }) {
  const [tersalin, setTersalin] = useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(kode);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Beberapa browser menolak akses papan klip tanpa HTTPS. Kodenya
      // tetap terlihat besar di layar sehingga masih bisa dicatat manual.
      setTersalin(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6 text-center">
      <h2 className="font-display text-lg font-bold text-brand-900">Pengajuan terkirim</h2>
      <p className="mt-1 text-sm text-brand-800">
        Catat kode di bawah ini. Petugas lab akan meninjau pengajuan Anda.
      </p>

      <div className="mx-auto mt-5 flex max-w-xs items-center justify-between gap-3 rounded-xl border border-brand-300 bg-white px-4 py-3">
        <code className="font-mono text-lg font-bold tracking-wide text-ink-900">{kode}</code>
        <button
          type="button"
          onClick={salin}
          aria-label="Salin kode peminjaman"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
        >
          {tersalin ? <Check size={16} className="text-brand-600" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          to={`/lacak?kode=${encodeURIComponent(kode)}`}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Lacak status pengajuan
        </Link>
        <button
          type="button"
          onClick={onAjukanLagi}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-brand-300 hover:bg-brand-100"
        >
          Ajukan alat ini lagi
        </button>
      </div>
    </div>
  );
}

function Isian({ label, wajib, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label} {wajib && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}
